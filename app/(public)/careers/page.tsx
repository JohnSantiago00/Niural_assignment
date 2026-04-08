import Link from "next/link";
import { RoleCard } from "@/components/role-card";
import { ButtonLink, Pill, PublicContainer, PublicHero, SurfaceCard } from "@/components/public-ui";
import { getOpenRoles } from "@/lib/supabase/queries";

export const revalidate = 0;

export default async function CareersPage() {
  const roles = await getOpenRoles();
  const teams = [...new Set(roles.map((role) => role.team))];

  return (
    <PublicContainer className="py-10 sm:py-14">
      <PublicHero
        eyebrow="Careers at Niural"
        title="Build the operating layer for modern hiring."
        description="Join a small, product-minded team designing calm, reliable systems for talent workflows that usually feel messy."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ButtonLink href={roles[0] ? `/careers/${roles[0].id}` : "/apply"} size="lg">
            View open roles
          </ButtonLink>
          <Link href="/apply" className="text-sm font-semibold text-slate-600 hover:text-ink">
            Submit an application
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Pill>{roles.length} open {roles.length === 1 ? "role" : "roles"}</Pill>
          {teams.slice(0, 3).map((team) => (
            <Pill key={team}>{team}</Pill>
          ))}
        </div>
      </PublicHero>

      <div className="mt-14">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">
            Open positions
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-ink">
            Find where your work fits.
          </h2>
        </div>
      </div>

      <div className="mt-8 grid gap-5">
        {roles.length > 0 ? (
          roles.map((role) => <RoleCard key={role.id} role={role} />)
        ) : (
          <SurfaceCard className="border-dashed p-10 text-center">
            <p className="text-xl font-semibold tracking-[-0.03em] text-ink">
              No open roles right now.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
              We still welcome thoughtful introductions. Send an application
              and we&apos;ll keep your details on hand for upcoming openings.
            </p>
            <ButtonLink href="/apply" className="mt-6">
              Open application form
            </ButtonLink>
          </SurfaceCard>
        )}
      </div>
    </PublicContainer>
  );
}
