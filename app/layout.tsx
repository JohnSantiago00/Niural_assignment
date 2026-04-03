import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niural Careers",
  description: "AI-powered candidate onboarding foundation for Phase A."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-line bg-panel/90 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/careers" className="text-lg font-semibold tracking-tight">
                Niural Hiring
              </Link>
              <nav className="flex items-center gap-5 text-sm text-slate-600">
                <Link href="/careers" className="hover:text-ink">
                  Careers
                </Link>
                <Link href="/apply" className="hover:text-ink">
                  Apply
                </Link>
                <Link href="/admin" className="hover:text-ink">
                  Admin
                </Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

