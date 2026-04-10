import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    companyName: string;
    role: string;
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
        const rl = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
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
        }[]>`
          SELECT
            u.id, u.name, u.email, u.password_hash, u.role,
            u.company_id,
            c.name AS company_name
          FROM users u
          JOIN companies c ON c.id = u.company_id
          WHERE u.email = ${credentials.email.toLowerCase().trim()}
          LIMIT 1
        `;

        const user = rows[0];
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

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
