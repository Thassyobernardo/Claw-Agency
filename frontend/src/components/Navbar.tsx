"use client";

import { motion } from "framer-motion";
import { Menu, X, Leaf } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { name: "How It Works", href: "#how-it-works" },
  { name: "Pricing",      href: "#pricing" },
  { name: "Contact",      href: "#contact" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center px-6 py-5">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex h-16 w-full max-w-5xl items-center justify-between rounded-2xl border border-aw-gray-border bg-white/90 px-8 shadow-sm backdrop-blur-xl"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aw-green">
            <Leaf size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-aw-slate">
            EcoLink<span className="text-aw-green">.</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-[15px] font-semibold text-aw-slate-mid transition-colors hover:text-aw-slate"
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="text-[15px] font-semibold text-aw-slate-mid transition-colors hover:text-aw-slate"
          >
            Dashboard
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-aw-green px-6 py-2.5 text-[15px] font-bold text-white transition-all hover:bg-aw-green-dark active:scale-95"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="flex md:hidden text-aw-slate"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </motion.div>

      {/* Mobile Menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-24 left-6 right-6 flex flex-col gap-4 rounded-2xl border border-aw-gray-border bg-white p-8 shadow-xl md:hidden"
        >
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="text-lg font-bold text-aw-slate/80"
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="text-lg font-bold text-aw-slate/80"
          >
            Dashboard
          </Link>
          <Link
            href="/signup"
            onClick={() => setIsOpen(false)}
            className="mt-2 rounded-xl bg-aw-green py-4 text-center font-bold text-white"
          >
            Start Free Trial
          </Link>
        </motion.div>
      )}
    </nav>
  );
}
