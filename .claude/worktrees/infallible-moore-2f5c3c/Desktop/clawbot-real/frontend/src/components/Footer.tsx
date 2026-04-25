import Link from "next/link";
import { Leaf } from "lucide-react";

const sections = [
  {
    title: "Product",
    links: [
      { name: "How It Works", href: "/#how-it-works" },
      { name: "Pricing",      href: "/#pricing" },
      { name: "Dashboard",    href: "/dashboard" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { name: "AASB S1 / S2",   href: "/compliance/aasb" },
      { name: "NGA Factors",    href: "/compliance/nga-factors" },
      { name: "Scope 3 Guide",  href: "/compliance/scope-3" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy Policy",  href: "/legal/privacy" },
      { name: "Terms of Service", href: "/legal/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-aw-gray-border bg-white px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">

          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green">
                <Leaf size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-aw-slate">
                EcoLink<span className="text-aw-green">.</span>
              </span>
            </Link>
            <p className="text-sm text-aw-slate-mid font-medium leading-relaxed max-w-xs">
              Automated carbon accounting for Australian SMEs. AASB S2 compliant reports in minutes.
            </p>
          </div>

          {/* Link columns */}
          {sections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-bold uppercase tracking-widest text-aw-slate mb-4">
                {section.title}
              </p>
              <ul className="flex flex-col gap-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-aw-slate-mid hover:text-aw-green transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-aw-gray-border pt-8">
          <p className="text-xs text-aw-slate-light font-medium">
            © {new Date().getFullYear()} EcoLink Australia Pty Ltd. All rights reserved.
          </p>
          <p className="text-xs text-aw-slate-light font-medium">
            Emissions calculated under NGA Factors 2023–24 · AASB S1 / S2 compliant
          </p>
        </div>
      </div>
    </footer>
  );
}
