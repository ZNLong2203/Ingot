"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { site } from "@/lib/site";
import { Logo } from "./Logo";

const nav: { href: string; label: string; icon: IconName }[] = [
  { href: "/verify", label: "Check a passport", icon: "shieldCheck" },
  { href: "/ledger", label: "Ledger", icon: "chain" },
  { href: "/method", label: "Method", icon: "calc" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <Logo className="h-6 w-6" />
          {site.name}
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 overflow-x-auto text-sm">
          {nav.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium ${
                  active ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                }`}
              >
                <Icon name={n.icon} className="hidden h-4 w-4 sm:block" />
                {n.label}
              </Link>
            );
          })}
          <Link
            href="/demo"
            className="ml-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-[var(--molten)] to-[#f59e0b] px-3 py-1.5 font-semibold text-white shadow-sm hover:brightness-110"
          >
            <Icon name="play" className="h-4 w-4" /> Try the flow
          </Link>
        </nav>
      </div>
    </header>
  );
}
