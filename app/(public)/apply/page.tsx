import { ApplicationForm } from "@/components/application-form";
import { getOpenRoles } from "@/lib/supabase/queries";

type ApplyPageProps = {
  searchParams: Promise<{
    roleId?: string;
  }>;
};

export const revalidate = 0;

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const resolvedSearchParams = await searchParams;
  const roles = await getOpenRoles();
  const requestedRoleId = resolvedSearchParams.roleId;
  const selectedRole =
    requestedRoleId ? roles.find((role) => role.id === requestedRoleId) ?? null : null;
  const hasInvalidRoleParam = Boolean(requestedRoleId && !selectedRole);

  return (
    <section className="mx-auto max-w-4xl px-6 py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Candidate Application
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          {selectedRole
            ? `You are applying for ${selectedRole.title}.`
            : "Submit your application."}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          {selectedRole
            ? `We carried your selected role forward so you can focus on completing the application.`
            : "This Phase A workflow validates the role, uploads the resume to Supabase Storage, creates the application and candidate records, and sends a confirmation email."}
        </p>
      </div>

      {hasInvalidRoleParam ? (
        <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          The selected role link is no longer valid. You can still apply by choosing any open role below.
        </div>
      ) : null}

      <div className="mt-10">
        <ApplicationForm
          roles={roles}
          initialRoleId={selectedRole?.id}
          lockedRole={selectedRole}
        />
      </div>
    </section>
  );
}
