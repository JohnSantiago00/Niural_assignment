import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-[2rem] border border-line bg-panel p-10 text-center shadow-card">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">404</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          We couldn&apos;t find that page.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          The role may have been removed or the URL may be incorrect.
        </p>
        <Link
          href="/careers"
          className="mt-6 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
        >
          Return to careers
        </Link>
      </div>
    </section>
  );
}

