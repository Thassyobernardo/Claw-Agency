"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface XeroStatus {
  connected:   boolean;
  tenantName?: string;
  tokenValid?: boolean;
}

/**
 * XeroStatusBadge — fetches Xero connection status and renders a header badge.
 *
 * 🟢 Connected: "[tenantName]"   (green badge)
 * 🔴 Disconnected: "Xero"        (muted badge + link to xero-sync)
 * ⏳ Loading: spinner
 */
export default function XeroStatusBadge() {
  const [status,  setStatus]  = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/xero/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-aw-gray-border bg-white px-4 py-2 text-sm font-semibold text-aw-slate-mid">
        <Loader2 size={14} className="animate-spin" />
        <span className="hidden sm:inline">Checking Xero…</span>
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div
        id="xero-status-connected"
        className="flex items-center gap-2 rounded-xl border border-aw-green/30 bg-aw-green-light px-4 py-2 text-sm font-bold text-aw-green"
      >
        <CheckCircle2 size={14} />
        <span className="hidden sm:inline">{status.tenantName ?? "Xero Connected"}</span>
        <span className="inline sm:hidden">🟢</span>
      </div>
    );
  }

  return (
    <Link
      id="xero-status-disconnected"
      href="/dashboard/xero-sync"
      className="flex items-center gap-2 rounded-xl border border-aw-gray-border bg-white px-4 py-2 text-sm font-semibold text-aw-slate-mid transition-all hover:border-red-300 hover:text-red-500"
    >
      <XCircle size={14} className="text-red-400" />
      <span className="hidden sm:inline">🔴 Disconnected — Connect Xero</span>
      <span className="inline sm:hidden">🔴</span>
    </Link>
  );
}
