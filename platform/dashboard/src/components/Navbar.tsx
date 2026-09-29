"use client";

import Link from "next/link";
import { useState } from "react";
import { Shield, Menu, X } from "lucide-react";

const links = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#architecture", label: "Architecture" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Shield className="h-6 w-6 text-brand-500" />
          <span>CSaaS</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg gradient-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Start Free Trial
          </Link>
        </div>

        <button className="md:hidden text-slate-400" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 bg-slate-950 p-4 md:hidden">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="block py-2 text-slate-400" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link href="/login" className="block py-2 text-slate-300">Sign in</Link>
          <Link href="/register" className="mt-2 block rounded-lg gradient-brand px-4 py-2 text-center text-sm font-medium text-white">
            Start Free Trial
          </Link>
        </div>
      )}
    </nav>
  );
}
