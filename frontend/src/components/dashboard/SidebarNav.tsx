"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import {
  LayoutDashboard, ClipboardCheck, RefreshCw, FileText, Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",          label: "Dashboard",     icon: LayoutDashboard, exact: true  },
  { href: "/dashboard/review",   label: "Review Queue",  icon: ClipboardCheck,  exact: false },
  { href: "/dashboard/xero-sync",label: "Xero Sync",     icon: RefreshCw,       exact: false },
  { href: "/dashboard/reports",  label: "AASB Reports",  icon: FileText,        exact: false },
] as const;

const ACCOUNT_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings, exact: false },
] as const;

export default function SidebarNav({ children }: { children?: ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-aw-slate-light">
          Carbon Accounting
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                active
                  ? "bg-aw-green-light text-aw-green"
                  : "text-aw-slate-mid hover:bg-aw-gray/70 hover:text-aw-slate"
              }`}
            >
              <Icon
                size={16}
                className={active ? "text-aw-green" : "text-aw-slate-light group-hover:text-aw-green transition-colors"}
              />
              {label}
              {/* Review badge: pulse dot */}
              {href === "/dashboard/review" && !active && (
                <span className="ml-auto flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-yellow-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-aw-gray-border">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-aw-slate-light">
            Account
          </p>
          {ACCOUNT_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                  active
                    ? "bg-aw-green-light text-aw-green"
                    : "text-aw-slate-mid hover:bg-aw-gray/70 hover:text-aw-slate"
                }`}
              >
                <Icon
                  size={16}
                  className={active ? "text-aw-green" : "text-aw-slate-light group-hover:text-aw-green transition-colors"}
                />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
