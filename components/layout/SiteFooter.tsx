import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          {site.name} · built for the IEEE ClimateChain Global Hackathon 2026 · {site.track}
        </p>
        <p className="flex gap-4">
          <Link href="/method" className="hover:text-ink">
            Method
          </Link>
          <a href={site.repo} className="hover:text-ink">
            Source (MIT)
          </a>
        </p>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-6 text-xs text-muted sm:px-6">
        Companies, people and documents in the demo are fictional. This prototype is not legal or verification advice.
      </p>
    </footer>
  );
}
