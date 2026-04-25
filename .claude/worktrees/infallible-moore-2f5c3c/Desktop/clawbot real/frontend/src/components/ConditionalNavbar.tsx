"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

/**
 * Renders the global Navbar only on marketing/public routes.
 * Dashboard and app routes have their own sticky header.
 */
export default function ConditionalNavbar() {
  const pathname = usePathname();

  // Routes that manage their own header
  const appRoutes = ["/dashboard"];
  const isAppRoute = appRoutes.some((route) => pathname.startsWith(route));

  if (isAppRoute) return null;
  return <Navbar />;
}
