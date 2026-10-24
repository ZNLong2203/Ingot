import type { Metadata, Viewport } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"], weight: ["500", "600", "700", "800"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#111315" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="main" className="flex-1">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
