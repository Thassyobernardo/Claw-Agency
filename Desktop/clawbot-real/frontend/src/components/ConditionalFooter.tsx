"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

/**
 * Renders the global Footer only on marketing/public routes.
 * Dashboard and app routes have their own layout.
 */
export default function ConditionalFooter() {
  const pathname = usePathname();

  const appRoutes = ["/dashboard", "/billing"];
  const authRoutes = ["/login", "/signup", "/onboarding", "/forgot-password", "/reset-password"];
  const isHidden = [...appRoutes, ...authRoutes].some((route) => pathname.startsWith(route));

  if (isHidden) return null;
  return <Footer />;
}
