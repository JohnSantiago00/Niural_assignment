/**
 * Public application page. It resolves the optional `roleId` query param on the
 * server so the form can either lock in a chosen role or fall back to the
 * general "pick a role" experience.
 */
import { ApplicationForm } from "@/components/application-form";
import { PublicContainer, PublicHero } from "@/components/public-ui";
import { getOpenRoles } from "@/lib/supabase/queries";

type ApplyPageProps = {
  searchParams: Promise<{
    roleId?: string;
  }>;
};

export const revalidate = 0;

/**
 * Next.js 16 provides `searchParams` asynchronously in App Router page props,
 * so we resolve them before deciding whether the role should be preselected.
 */
export default async function ApplyPage({ searchParams }: ApplyPageProps) {
  const resolvedSearchParams = await searchParams;
  const roles = await getOpenRoles();
  const requestedRoleId = resolvedSearchParams.roleId;
  const selectedRole =
    requestedRoleId ? roles.find((role) => role.id === requestedRoleId) ?? null : null;
  const hasInvalidRoleParam = Boolean(requestedRoleId && !selectedRole);

  return (
    <PublicContainer className="max-w-5xl py-10 sm:py-14">
      <PublicHero
        eyebrow="Candidate application"
        title={selectedRole ? `Apply for ${selectedRole.title}.` : "Tell us where you could help."}
        description={
          selectedRole
            ? "We carried your selected role forward so the application stays focused and quick to complete."
            : "Share your background, choose an open role, and send us the context we need to review thoughtfully."
        }
      />

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
    </PublicContainer>
  );
}
