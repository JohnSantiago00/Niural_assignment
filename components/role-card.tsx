import Link from "next/link";
import type { RoleRecord } from "@/types/database";

type RoleCardProps = {
  role: RoleRecord;
};

export function RoleCard({ role }: RoleCardProps) {
  return (
    <article className="rounded-[2rem] border border-line bg-panel p-7 shadow-card">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-accent">{role.team}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            {role.title}
          </h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
            <span>{role.location}</span>
            <span>•</span>
            <span>{role.remote_status}</span>
            <span>•</span>
            <span>{role.experience_level}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/careers/${role.id}`}
            className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
          >
            View role
          </Link>
          <Link
            href={`/apply?roleId=${role.id}`}
            className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
          >
            Apply
          </Link>
        </div>
      </div>
    </article>
  );
}

