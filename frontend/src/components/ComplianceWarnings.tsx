"use client";

/**
 * ComplianceWarnings — surfaces all AASB S2 / NGER blockers and warnings
 * that prevent a clean PDF submission. Renders inline at the top of the
 * dashboard so the user sees them before clicking "Generate Report".
 *
 * Pulls from /api/dashboard/compliance.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Warning {
  level:   "blocker" | "warning" | "info";
  code:    string;
  count:   number;
  message: string;
  action:  string;
}

interface ComplianceData {
  ready_for_submission: boolean;
  blocker_count:        number;
  warning_count:        number;
  warnings:             Warning[];
}

export default function ComplianceWarnings() {
  const [data, setData]       = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/compliance")
      .then((r) => r.json())
      .then((d: ComplianceData) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading || !data) return null;

  if (data.ready_for_submission && data.warnings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-3">
        <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-900">Ready for AASB S2 submission</p>
          <p className="text-xs text-emerald-700 mt-0.5">All compliance checks passed.</p>
        </div>
      </div>
    );
  }

  const headline = data.blocker_count > 0
    ? `${data.blocker_count} blocker${data.blocker_count > 1 ? "s" : ""} prevent submission`
    : `${data.warning_count} warning${data.warning_count > 1 ? "s" : ""} to review`;

  const headlineClass = data.blocker_count > 0
    ? "border-red-200 bg-red-50"
    : "border-amber-200 bg-amber-50";

  const headlineIcon = data.blocker_count > 0
    ? <ShieldAlert size={22} className="text-red-600 flex-shrink-0" />
    : <AlertTriangle size={22} className="text-amber-600 flex-shrink-0" />;

  return (
    <div className={`rounded-2xl border ${headlineClass}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        {headlineIcon}
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{headline}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Resolve before generating a report for ASIC submission. Click to {open ? "hide" : "show"} details.
          </p>
        </div>
        <span className="text-xs text-gray-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-200/60 divide-y divide-gray-200/60">
          {data.warnings.map((w) => (
            <WarningRow key={w.code} warning={w} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarningRow({ warning }: { warning: Warning }) {
  const colour = warning.level === "blocker" ? "text-red-600" : "text-amber-600";

  // CTA destination by warning code
  const cta = (() => {
    switch (warning.code) {
      case "needs_review":
      case "low_confidence":
      case "no_activity_data":
      case "state_required":
        return { href: "/transactions/review", label: "Open Review queue" };
      case "governance_incomplete":
        return { href: "/settings/governance", label: "Open Governance Settings" };
      case "no_assurance":
        return { href: "/settings/assurance", label: "Manage Assurance" };
      default:
        return null;
    }
  })();

  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <AlertCircle size={18} className={`${colour} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{warning.message}</p>
        <p className="text-xs text-gray-600 mt-1">{warning.action}</p>
      </div>
      {cta && (
        <Link
          href={cta.href}
          className="text-xs font-bold text-gray-700 underline hover:text-gray-900 whitespace-nowrap mt-1"
        >
          {cta.label} →
        </Link>
      )}
    </div>
  );
}
