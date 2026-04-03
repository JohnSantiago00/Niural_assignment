import Link from "next/link";
import { RoleCard } from "@/components/role-card";
import { getOpenRoles } from "@/lib/supabase/queries";

export const revalidate = 0;

export default async function CareersPage() {
  const roles = await getOpenRoles();

  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Phase A Careers Portal
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Build the next generation of internal hiring operations.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Browse live openings pulled from Supabase, review the role details, and
          submit an application through a deterministic server workflow.
        </p>
      </div>

      <div className="mt-10 grid gap-6">
        {roles.length > 0 ? (
          roles.map((role) => <RoleCard key={role.id} role={role} />)
        ) : (
          <div className="rounded-3xl border border-dashed border-line bg-panel p-10 text-center shadow-card">
            <p className="text-lg font-medium text-slate-900">No open roles right now.</p>
            <p className="mt-2 text-sm text-slate-600">
              Seed the database or mark roles as open to populate this page.
            </p>
            <Link
              href="/apply"
              className="mt-6 inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
            >
              Open application form
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

