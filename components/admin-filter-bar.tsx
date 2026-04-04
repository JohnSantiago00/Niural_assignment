/**
 * GET-based filter bar for the Phase B admin dashboard. Keeping filters in the
 * URL makes the page server-rendered, shareable, and easy to debug.
 */
import type { CandidateDashboardFilters } from "@/types/admin";
import type { RoleRecord } from "@/types/database";
import { candidateWorkflowStatuses, getCandidateStatusLabel } from "@/lib/utils/candidate-status";

type AdminFilterBarProps = {
  roles: RoleRecord[];
  filters: CandidateDashboardFilters;
};

export function AdminFilterBar({ roles, filters }: AdminFilterBarProps) {
  return (
    <form className="rounded-[2rem] border border-line bg-panel p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div>
          <label htmlFor="roleId" className="mb-2 block text-sm font-medium text-slate-800">
            Role
          </label>
          <select
            id="roleId"
            name="roleId"
            defaultValue={filters.roleId ?? ""}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
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
          <label htmlFor="status" className="mb-2 block text-sm font-medium text-slate-800">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
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
          <label htmlFor="sort" className="mb-2 block text-sm font-medium text-slate-800">
            Sort
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={filters.sort ?? "newest"}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div>
          <label htmlFor="from" className="mb-2 block text-sm font-medium text-slate-800">
            From date
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
          />
        </div>

        <div>
          <label htmlFor="to" className="mb-2 block text-sm font-medium text-slate-800">
            To date
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
          />
        </div>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accentDark"
          >
            Apply filters
          </button>
          <a
            href="/admin"
            className="inline-flex rounded-full border border-line px-5 py-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
          >
            Reset
          </a>
        </div>
      </div>
    </form>
  );
}
