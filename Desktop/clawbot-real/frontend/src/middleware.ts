import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// NOTE: /api/billing/webhook MUST stay public — Stripe calls it without a session cookie.
// If you add more billing sub-routes, list them explicitly here rather than using /api/billing/:path*.
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/billing/:path*",
    "/api/dashboard/:path*",
    "/api/report/:path*",
    "/api/xero/:path*",
    "/api/myob/:path*",
    "/api/transactions/:path*",
    "/api/billing/checkout",
    "/api/billing/portal",
  ],
};
