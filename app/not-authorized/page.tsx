/**
 * Clean denial page for authenticated users who are not part of the internal
 * admin allowlist.
 */
import Link from "next/link";

export default function NotAuthorizedPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-[2rem] border border-line bg-panel p-10 shadow-card">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Not Authorized
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          You are signed in, but you do not have admin access.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          This dashboard is limited to internal hiring teammates whose email has
          been added to the admin allowlist.
        </p>

        <Link
          href="/careers"
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accentDark"
        >
          Return to careers
        </Link>
      </div>
    </section>
  );
}
