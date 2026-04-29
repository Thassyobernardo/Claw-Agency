import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";


// ─── Extend next-auth types ───────────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      companyId: string;
      companyName: string;
      role: string;
    };
  }
  interface User {
    companyId: string;
    companyName: string;
    role: string;
    plan: string;
    createdAt: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    companyName: string;
    role: string;
    plan: string;
    createdAt: string;
  }
}

// ─── Auth options ─────────────────────────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days

  pages: {
    signIn:  "/login",
    signOut: "/login",
    error:   "/login",
  },

  providers: [
    // ── Magic Link (Email OTP via Resend) ──────────────────────────────────
    // Users enter their email; NextAuth sends a one-time sign-in link.
    // The email is verified at click time — no separate confirm step.
    // Requires: RESEND_API_KEY, EMAIL_FROM in .env.local
    // NOTE: This requires a database adapter (e.g. @auth/pg-adapter) for
    //       production. For MVP, Magic Link is wired but credentials remain primary.
    ...(process.env.RESEND_API_KEY
      ? [
          EmailProvider({
            server: {
              host:   "smtp.resend.com",
              port:   465,
              auth: {
                user: "resend",
                pass: process.env.RESEND_API_KEY,
              },
            },
            from: process.env.EMAIL_FROM ?? "noreply@ecolink.com.au",
          }),
        ]
      : []),

    // ── Email + Password ────────────────────────────────────────────────────
    CredentialsProvider({

      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // ── Rate limit: 5 attempts per 15 min per IP ─────────────────────────
        const ip = (req as any)?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
          ?? (req as any)?.headers?.["x-real-ip"]
          ?? "unknown";
        const rl = await checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
        if (!rl.allowed) {
          throw new Error("TooManyRequests");
        }

        const rows = await sql<{
          id: string;
          name: string;
          email: string;
          password_hash: string;
          role: string;
          company_id: string;
          company_name: string;
          email_verified: boolean;
          plan: string;
          created_at: Date;
        }[]>`
          SELECT
            u.id, u.name, u.email, u.password_hash, u.role,
            u.company_id,
            u.email_verified,
            c.name AS company_name,
            c.plan,
            c.created_at
          FROM users u
          JOIN companies c ON c.id = u.company_id
          WHERE u.email = ${credentials.email.toLowerCase().trim()}
          LIMIT 1
        `;

        const user = rows[0];
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        if (!user.email_verified) {
          throw new Error("EmailNotVerified");
        }

        // Update last_login_at
        await sql`
          UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}
        `;

        return {
          id:          user.id,
          name:        user.name,
          email:       user.email,
          companyId:   user.company_id,
          companyName: user.company_name,
          role:        user.role,
          plan:        user.plan,
          createdAt:   user.created_at.toISOString(),
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = user.id;
        token.companyId   = user.companyId;
        token.companyName = user.companyName;
        token.role        = user.role;
        token.plan        = user.plan;
        token.createdAt   = user.createdAt;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id          = token.id;
      session.user.companyId   = token.companyId;
      session.user.companyName = token.companyName;
      session.user.role        = token.role;
      return session;
    },
  },
};
