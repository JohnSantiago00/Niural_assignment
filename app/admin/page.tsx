export default function AdminPage() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-14">
      <div className="rounded-[2rem] border border-line bg-panel p-8 shadow-card">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Admin Placeholder
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Phase A focuses on the public submission flow.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
          The admin surface is intentionally left minimal for now so the
          implementation stays aligned with the assignment scope. Future phases can
          build review queues, AI screening, and operations tooling on top of the
          records created here.
        </p>
      </div>
    </section>
  );
}

