import { ApplicationForm } from "@/components/application-form";
import { getOpenRoles } from "@/lib/supabase/queries";

type ApplyPageProps = {
  searchParams: {
    roleId?: string;
  };
};

export const revalidate = 0;

export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const roles = await getOpenRoles();

  return (
    <section className="mx-auto max-w-4xl px-6 py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Candidate Application
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Submit your application.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          This Phase A workflow validates the role, uploads the resume to Supabase
          Storage, creates the application and candidate records, and sends a
          confirmation email.
        </p>
      </div>

      <div className="mt-10">
        <ApplicationForm roles={roles} initialRoleId={searchParams.roleId} />
      </div>
    </section>
  );
}

