/**
 * Internal Phase B dashboard listing candidates already created by the public
 * intake flow. It stays server-rendered so the page is deterministic and easy
 * to reason about.
 */
import { AdminCandidateTable } from "@/components/admin-candidate-table";
import { AdminFilterBar } from "@/components/admin-filter-bar";
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
    <section className="mx-auto max-w-7xl px-6 py-14">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Internal Hiring Dashboard
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Review submitted candidates in one place.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Phase B turns the Phase A intake pipeline into an internal review
          surface. Operators can scan candidates, filter the list, and open a
          single candidate profile for more detail.
        </p>
      </div>

      <div className="mt-10">
        {resolvedSearchParams.deleted ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Candidate test data was hard deleted successfully. The same email can now reapply for the same role.
          </div>
        ) : null}
        <AdminFilterBar roles={roles} filters={filters} />
      </div>

      <div className="mt-8">
        <AdminCandidateTable rows={rows} />
      </div>
    </section>
  );
}
