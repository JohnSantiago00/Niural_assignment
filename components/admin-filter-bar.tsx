/**
 * GET-based filter bar for the admin dashboard. Keeping filters in the URL
 * preserves server-rendered, shareable views without client state.
 */
import type { CandidateDashboardFilters } from "@/types/admin";
import type { RoleRecord } from "@/types/database";
import { Button, ButtonLink, SurfaceCard } from "@/components/public-ui";
import { candidateWorkflowStatuses, getCandidateStatusLabel } from "@/lib/utils/candidate-status";

type AdminFilterBarProps = {
  roles: RoleRecord[];
  filters: CandidateDashboardFilters;
};

export function AdminFilterBar({ roles, filters }: AdminFilterBarProps) {
  const controlClass =
    "w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";
  const labelClass = "mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500";

  return (
    <SurfaceCard className="p-5">
      <form>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label htmlFor="roleId" className={labelClass}>
              Role
            </label>
            <select
              id="roleId"
              name="roleId"
              defaultValue={filters.roleId ?? ""}
              className={controlClass}
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status ?? ""}
              className={controlClass}
            >
              <option value="">All statuses</option>
              {candidateWorkflowStatuses.map((status) => (
                <option key={status} value={status}>
                  {getCandidateStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sort" className={labelClass}>
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={filters.sort ?? "newest"}
              className={controlClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div>
            <label htmlFor="from" className={labelClass}>
              From date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className={controlClass}
            />
          </div>

          <div>
            <label htmlFor="to" className={labelClass}>
              To date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className={controlClass}
            />
          </div>

          <div className="flex items-end gap-3">
            <Button type="submit" size="lg" className="bg-accent px-5 text-sm hover:bg-accentDark">
              Apply filters
            </Button>
            <ButtonLink href="/admin" variant="secondary" size="lg" className="px-5 text-sm">
              Reset
            </ButtonLink>
          </div>
        </div>
      </form>
    </SurfaceCard>
  );
}
