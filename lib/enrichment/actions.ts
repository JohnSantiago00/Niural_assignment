"use server";

/**
 * Server action for manual shortlist-only profile enrichment.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminUser } from "@/lib/auth/authorization";
import { runCandidateEnrichment } from "@/lib/enrichment/run-enrichment";

function candidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

function redirectWithMessage(
  candidateId: string,
  key: "enrichment" | "enrichmentError",
  value: string
): never {
  redirect(`${candidatePath(candidateId)}?${key}=${encodeURIComponent(value)}`);
}

export async function runCandidateEnrichmentAction(candidateId: string) {
  await requireAdminUser();

  try {
    await runCandidateEnrichment(candidateId);
    revalidatePath("/admin");
    revalidatePath(candidatePath(candidateId));
    redirectWithMessage(candidateId, "enrichment", "completed");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Profile enrichment failed.";
    redirectWithMessage(candidateId, "enrichmentError", message);
  }
}
