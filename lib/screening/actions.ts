"use server";

/**
 * Server actions for manual AI screening and shortlist override decisions.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/lib/auth/authorization";
import { runCandidateScreening } from "@/lib/screening/run-screening";
import { shortlistOverrideSchema } from "@/lib/screening/schema";

function candidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

function redirectWithMessage(
  candidateId: string,
  key: "screening" | "screeningError" | "override" | "overrideError",
  value: string
): never {
  redirect(`${candidatePath(candidateId)}?${key}=${encodeURIComponent(value)}`);
}

function normalizeOverrideNote(value: string) {
  return value.trim();
}

/**
 * Manual trigger for Phase C1 screening. Keeping this as a button makes the
 * flow easy to demo and avoids premature job/queue complexity.
 */
export async function runCandidateScreeningAction(candidateId: string) {
  await requireAdminUser();

  try {
    await runCandidateScreening(candidateId);
    revalidatePath("/admin");
    revalidatePath(candidatePath(candidateId));
    redirectWithMessage(candidateId, "screening", "completed");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Screening failed.";
    redirectWithMessage(candidateId, "screeningError", message);
  }
}

/**
 * Lets an admin override the shortlist outcome while leaving the AI result
 * visible. Deterministic app logic updates status and override fields together.
 */
export async function overrideCandidateShortlistAction(
  candidateId: string,
  formData: FormData
) {
  await requireAdminUser();

  const parsed = shortlistOverrideSchema.safeParse({
    decision: formData.get("decision"),
    note: formData.get("note")
  });

  if (!parsed.success) {
    redirectWithMessage(candidateId, "overrideError", parsed.error.issues[0]?.message ?? "Invalid override input.");
  }

  const nextStatus = parsed.data.decision === "shortlist" ? "shortlisted" : "screened";
  const supabase = createSupabaseAdminClient();
  const normalizedNote = normalizeOverrideNote(parsed.data.note);

  const { data: existingCandidate, error: existingCandidateError } = await supabase
    .from("candidates")
    .select("admin_override, admin_override_note, current_status")
    .eq("id", candidateId)
    .maybeSingle();

  if (existingCandidateError || !existingCandidate) {
    redirectWithMessage(
      candidateId,
      "overrideError",
      existingCandidateError?.message ?? "Candidate not found."
    );
  }

  // If the admin resubmits the same override state and note, keep the workflow
  // clean by skipping duplicate audit log entries.
  const isNoopOverride =
    existingCandidate.admin_override === true &&
    existingCandidate.current_status === nextStatus &&
    (existingCandidate.admin_override_note ?? "") === normalizedNote;

  if (isNoopOverride) {
    revalidatePath("/admin");
    revalidatePath(candidatePath(candidateId));
    redirectWithMessage(candidateId, "override", "saved");
  }

  const { error: candidateError } = await supabase
    .from("candidates")
    .update({
      admin_override: true,
      admin_override_note: normalizedNote,
      current_status: nextStatus
    })
    .eq("id", candidateId);

  if (candidateError) {
    redirectWithMessage(candidateId, "overrideError", candidateError.message);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    candidate_id: candidateId,
    action_type: "admin_shortlist_override",
    action_detail: `Admin override set candidate status to ${nextStatus}. Note: ${normalizedNote}`,
    actor: "admin"
  });

  if (auditError) {
    console.error("Failed to insert shortlist override audit log", auditError);
  }

  revalidatePath("/admin");
  revalidatePath(candidatePath(candidateId));
  redirectWithMessage(candidateId, "override", "saved");
}
