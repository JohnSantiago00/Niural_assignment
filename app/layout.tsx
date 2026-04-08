/**
 * Global app shell. The header now reflects whether the lightweight internal
 * auth state is present so navigation matches the user's current identity and
 * authorization level. Admin pages intentionally use a more internal-feeling
 * nav so the operator experience does not mirror the public candidate flow.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getAuthState } from "@/lib/auth/authorization";
import { logoutUser } from "@/lib/auth/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niural Careers",
  description: "AI-powered hiring workflow for candidate intake and onboarding."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const currentPath = headerStore.get("x-current-path") ?? "";
  const isCareersFlow =
    currentPath === "/careers" ||
    currentPath.startsWith("/careers/") ||
    currentPath === "/apply";
  const authState = await getAuthState();

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
                {isCareersFlow ? (
                  <Link href="/apply" className="hover:text-ink">
                    Apply
                  </Link>
                ) : null}
                {!authState.user ? (
                  <Link href="/login" className="hover:text-ink">
                    Login
                  </Link>
                ) : null}
                {authState.user && authState.isAdmin ? (
                  <>
                    <Link href="/admin" className="hover:text-ink">
                      Admin
                    </Link>
                    <form action={logoutUser}>
                      <button type="submit" className="hover:text-ink">
                        Logout
                      </button>
                    </form>
                  </>
                ) : authState.user ? (
                  <form action={logoutUser}>
                    <button type="submit" className="hover:text-ink">
                      Logout
                    </button>
                  </form>
                ) : null}
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
