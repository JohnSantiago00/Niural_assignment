import Link from "next/link";
import { notFound } from "next/navigation";
import { getRoleById } from "@/lib/supabase/queries";

type RoleDetailPageProps = {
  params: {
    roleId: string;
  };
};

export const revalidate = 0;

export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const role = await getRoleById(params.roleId);

  if (!role) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <Link href="/careers" className="text-sm font-medium text-accent hover:text-accentDark">
        Back to careers
      </Link>

      <div className="mt-6 rounded-[2rem] border border-line bg-panel p-8 shadow-card">
        <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-accent">{role.team}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
              {role.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>{role.location}</span>
              <span>•</span>
              <span>{role.remote_status}</span>
              <span>•</span>
              <span>{role.experience_level}</span>
            </div>
          </div>

          <Link
            href={`/apply?roleId=${role.id}`}
            className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accentDark"
          >
            Apply for this role
          </Link>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Responsibilities</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {role.responsibilities.map((item) => (
                <li key={item} className="rounded-2xl border border-line bg-white px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">Requirements</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              {role.requirements.map((item) => (
                <li key={item} className="rounded-2xl border border-line bg-white px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

