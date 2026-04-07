"use server";

/**
 * Admin-only Phase 06 retry/check action. It performs a real Slack lookup by
 * candidate email and only sends welcome/HR messages when Slack confirms the
 * user exists in the workspace.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminUser } from "@/lib/auth/authorization";
import { checkSlackJoinForCandidate } from "@/lib/slack/workflow";

function adminCandidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

export async function checkSlackJoinAction(candidateId: string) {
  await requireAdminUser();

  try {
    await checkSlackJoinForCandidate(candidateId);
    revalidatePath(adminCandidatePath(candidateId));
    redirect(`${adminCandidatePath(candidateId)}?slack=checked`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to check Slack onboarding.";
    redirect(`${adminCandidatePath(candidateId)}?slackError=${encodeURIComponent(message)}`);
  }
}
