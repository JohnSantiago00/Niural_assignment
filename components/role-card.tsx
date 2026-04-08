import Link from "next/link";
import { ButtonLink, Pill, SurfaceCard } from "@/components/public-ui";
import type { RoleRecord } from "@/types/database";

type RoleCardProps = {
  role: RoleRecord;
};

export function RoleCard({ role }: RoleCardProps) {
  return (
    <SurfaceCard className="group overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-glow">
      <article className="relative p-6 sm:p-7">
        <div className="absolute inset-y-0 left-0 w-1 bg-accent/70 opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill className="border-accent/20 bg-accent/10 text-accent">{role.team}</Pill>
              <Pill>{role.experience_level}</Pill>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-ink sm:text-3xl">
              <Link href={`/careers/${role.id}`} className="hover:text-accent">
                {role.title}
              </Link>
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
              <Pill>{role.location}</Pill>
              <Pill>{role.remote_status}</Pill>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">
              Help shape the systems behind a faster, more thoughtful hiring experience.
              Review the role details and apply when you&apos;re ready.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <ButtonLink href={`/careers/${role.id}`} variant="secondary">
              View role
            </ButtonLink>
            <ButtonLink href={`/apply?roleId=${role.id}`}>
              Apply now
            </ButtonLink>
          </div>
        </div>
      </article>
    </SurfaceCard>
  );
}
