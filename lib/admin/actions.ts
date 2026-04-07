"use server";

/**
 * Admin-only destructive actions for prototype maintenance. These are kept out
 * of normal product workflows because hard deletion is intended only for QA
 * data resets in this take-home prototype.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminUser } from "@/lib/auth/authorization";
import { hardDeleteCandidate } from "@/lib/admin/delete-candidate";

function candidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

export async function hardDeleteCandidateAction(candidateId: string, formData: FormData) {
  await requireAdminUser();
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  if (confirmation !== "DELETE") {
    redirect(
      `${candidatePath(candidateId)}?deleteError=${encodeURIComponent("Type DELETE to confirm this QA hard delete.")}`
    );
  }

  try {
    await hardDeleteCandidate(candidateId);
    revalidatePath("/admin");
    redirect("/admin?deleted=1");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to delete candidate test data.";
    redirect(`${candidatePath(candidateId)}?deleteError=${encodeURIComponent(message)}`);
  }
}
