import { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Leaf, Building2, LogOut } from "lucide-react";
import XeroStatusBadge from "@/components/dashboard/XeroStatusBadge";
import SidebarNav from "@/components/dashboard/SidebarNav";

// ─── Layout ───────────────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Server-side auth guard — middleware handles redirects, but we double-check
  // here to get the session data (name, email) for the sidebar user panel.
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user) {
    redirect("/login");
  }

  const userName    = session.user.name  ?? session.user.email ?? "User";
  const userEmail   = session.user.email ?? "";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-aw-gray/30">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-aw-gray-border bg-white">

        {/* Logo */}
        <div className="px-6 py-5 border-b border-aw-gray-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green shadow-sm shadow-aw-green/30 transition-transform group-hover:scale-105">
              <Leaf size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-aw-slate">
              EcoLink<span className="text-aw-green">.</span>
            </span>
          </Link>
        </div>

        {/* Navigation — client component for usePathname() active state */}
        <SidebarNav />

        {/* User panel — server-rendered with session data */}
        <div className="px-4 py-4 border-t border-aw-gray-border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aw-green-light border border-aw-green/20">
              <span className="text-sm font-black text-aw-green">{userInitial}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-aw-slate truncate">{userName}</p>
              <p className="text-[11px] text-aw-slate-light truncate">{userEmail}</p>
            </div>
            <Link
              href="/api/auth/signout"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-aw-slate-light hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut size={15} />
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-aw-gray-border bg-white/90 backdrop-blur-md">

          {/* Mobile logo */}
          <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-aw-green">
              <Leaf size={13} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-base tracking-tight text-aw-slate">
              EcoLink<span className="text-aw-green">.</span>
            </span>
          </Link>

          {/* Company name */}
          <div className="hidden md:flex items-center gap-2 text-aw-slate-mid">
            <Building2 size={15} />
            <span className="text-sm font-semibold truncate max-w-[200px]">
              {userName}
            </span>
          </div>

          {/* Xero status badge */}
          <XeroStatusBadge />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
