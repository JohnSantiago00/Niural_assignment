/**
 * Public role detail page. It is intentionally simple: resolve the role ID,
 * fetch the role, show the job description, and hand off to the apply flow.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Eyebrow, Pill, PublicContainer, SurfaceCard } from "@/components/public-ui";
import { getRoleById } from "@/lib/supabase/queries";

type RoleDetailPageProps = {
  params: Promise<{
    roleId: string;
  }>;
};

export const revalidate = 0;

/**
 * Next.js 16 resolves dynamic route params asynchronously in App Router page
 * components, so `roleId` must be awaited before it is used.
 */
export default async function RoleDetailPage({ params }: RoleDetailPageProps) {
  const { roleId } = await params;
  const role = await getRoleById(roleId);

  if (!role) {
    notFound();
  }

  return (
    <PublicContainer className="py-10 sm:py-14">
      <Link href="/careers" className="text-sm font-semibold text-accent hover:text-accentDark">
        ← Back to careers
      </Link>

      <SurfaceCard className="mt-6 overflow-hidden">
        <div className="relative border-b border-line/70 bg-hero p-8 sm:p-10">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Eyebrow>{role.team}</Eyebrow>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-ink sm:text-5xl">
                {role.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                A focused role for someone who likes turning ambiguous hiring
                operations into clear, dependable product systems.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Pill>{role.location}</Pill>
                <Pill>{role.remote_status}</Pill>
                <Pill>{role.experience_level}</Pill>
              </div>
            </div>
            <ButtonLink href={`/apply?roleId=${role.id}`} size="lg">
              Apply for this role
            </ButtonLink>
          </div>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <div>
              <Eyebrow className="text-slate-500">You will</Eyebrow>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">
                Responsibilities
              </h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
              {role.responsibilities.map((item) => (
                <li key={item} className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 shadow-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div>
              <Eyebrow className="text-slate-500">You bring</Eyebrow>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-ink">
                Requirements
              </h2>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
              {role.requirements.map((item) => (
                <li key={item} className="rounded-2xl border border-line/70 bg-white/80 px-4 py-3 shadow-sm">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-line/70 bg-white/60 p-6 sm:p-8">
          <div className="flex flex-col gap-4 rounded-[1.75rem] bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
                Ready to talk?
              </p>
              <p className="mt-2 text-xl font-semibold tracking-[-0.03em]">
                Send us your application for {role.title}.
              </p>
            </div>
            <ButtonLink href={`/apply?roleId=${role.id}`} variant="secondary">
              Start application
            </ButtonLink>
          </div>
        </div>
      </SurfaceCard>
    </PublicContainer>
  );
}
