import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "./Logo";

const nav = [
  { href: "/demo", label: "Try the flow" },
  { href: "/verify", label: "Check a passport" },
  { href: "/ledger", label: "Ledger" },
  { href: "/method", label: "Method & limits" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75 sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <Logo className="h-6 w-6" />
          {site.name}
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 overflow-x-auto text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
