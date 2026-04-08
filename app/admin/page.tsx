/**
 * Internal hiring dashboard listing candidates created by the public intake
 * flow. It stays server-rendered so the page remains deterministic and fast.
 */
import { AdminCandidateTable } from "@/components/admin-candidate-table";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { Pill, PublicContainer, PublicHero, SurfaceCard } from "@/components/public-ui";
import { requireAdminUser } from "@/lib/auth/authorization";
import {
  getAdminRoles,
  getCandidateDashboardRows,
  parseCandidateDashboardFilters
} from "@/lib/admin/queries";

type AdminPageProps = {
  searchParams: Promise<{
    roleId?: string;
    status?: string;
    from?: string;
    to?: string;
    sort?: string;
    deleted?: string;
  }>;
};

export const revalidate = 0;

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdminUser();
  const resolvedSearchParams = await searchParams;
  const filters = parseCandidateDashboardFilters(resolvedSearchParams);
  const [roles, rows] = await Promise.all([
    getAdminRoles(),
    getCandidateDashboardRows(filters)
  ]);

  return (
    <PublicContainer className="py-12 sm:py-14">
      <PublicHero
        eyebrow="Admin portal"
        title="Candidates"
        description="Manage applications, interviews, offers, and onboarding in one place."
      >
        <div className="flex flex-wrap gap-3">
          <Pill>{rows.length} visible candidates</Pill>
          <Pill>{roles.length} open roles</Pill>
          <Pill>Newest applications first</Pill>
        </div>
      </PublicHero>

      <div className="mt-10">
        {resolvedSearchParams.deleted ? (
          <SurfaceCard className="mb-6 border-emerald-200 bg-emerald-50/90 px-5 py-4 text-sm text-emerald-800">
            Candidate test data was deleted. The same email can now reapply for the same role.
          </SurfaceCard>
        ) : null}
        <AdminFilterBar roles={roles} filters={filters} />
      </div>

      <div className="mt-8">
        <AdminCandidateTable rows={rows} />
      </div>
    </PublicContainer>
  );
}
