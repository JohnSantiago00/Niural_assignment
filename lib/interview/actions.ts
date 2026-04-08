"use server";

/**
 * Admin-only Phase 04 actions. Interview completion can be simulated for demo
 * purposes, while feedback stays deterministic and can only be saved after an
 * interview has completed.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createInputFingerprint } from "@/lib/ai/fingerprint";
import { requireAdminUser } from "@/lib/auth/authorization";
import {
  buildDeterministicInterviewSummary,
  isRecoverableGeminiAvailabilityError,
  summarizeInterviewTranscript
} from "@/lib/gemini/summarize-interview";
import { buildSimulatedInterviewTranscript } from "@/lib/interview/simulate-interview";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getGeminiModel } from "@/lib/utils/env";
import type {
  CandidateRecord,
  InterviewTranscriptRecord,
  InterviewRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord
} from "@/types/database";

const INTERVIEW_SUMMARY_PROMPT_VERSION = "interview-summary-v1";

function candidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientSupabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return /fetch failed|network|timeout|temporar/i.test(message);
}

async function runSupabaseMutationWithRetry(
  label: string,
  operation: () => Promise<{ error: { message: string } | null }>
) {
  let lastError: { message: string } | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await operation();

    if (!error) {
      return;
    }

    lastError = error;

    if (!isTransientSupabaseError(error) || attempt === 3) {
      break;
    }

    await sleep(250 * attempt);
  }

  throw new Error(`${label}: ${lastError?.message ?? "Unknown database error"}`);
}

async function markInterviewCompleted(input: {
  candidateId: string;
  interviewId: string;
}) {
  const supabase = createSupabaseAdminClient();

  // These writes are safe to retry and idempotent. Supabase/PostgREST can
  // occasionally surface transient `fetch failed` errors during local QA; a
  // short retry prevents the workflow from getting stuck after transcript save.
  await runSupabaseMutationWithRetry("Failed to mark interview complete", async () =>
    await supabase
      .from("interviews")
      .update({ interview_status: "completed" })
      .eq("id", input.interviewId)
  );

  await runSupabaseMutationWithRetry("Failed to update candidate status after interview", async () =>
    await supabase
      .from("candidates")
      .update({ current_status: "interview_completed" })
      .eq("id", input.candidateId)
  );
}

async function writeAuditLog(candidateId: string, actionType: string, actionDetail: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    candidate_id: candidateId,
    action_type: actionType,
    action_detail: actionDetail,
    actor: "admin"
  });

  if (error) {
    console.error("Failed to write interview audit log", error);
  }
}

async function getInterviewContext(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const [
    { data: candidate, error: candidateError },
    { data: interview, error: interviewError }
  ] = await Promise.all([
    supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle<CandidateRecord>(),
    supabase.from("interviews").select("*").eq("candidate_id", candidateId).maybeSingle<InterviewRecord>()
  ]);

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for interview action: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (interviewError || !interview) {
    throw new Error(`Failed to load interview for interview action: ${interviewError?.message ?? "Interview not found"}`);
  }

  return { candidate, interview };
}

function buildInterviewSummaryFingerprint(input: {
  candidateName: string;
  roleTitle: string;
  transcriptText: string;
  modelName: string;
}) {
  return createInputFingerprint({
    promptVersion: INTERVIEW_SUMMARY_PROMPT_VERSION,
    modelName: input.modelName,
    candidateName: input.candidateName,
    roleTitle: input.roleTitle,
    transcriptText: input.transcriptText
  });
}

export async function simulateInterviewCompleteAction(candidateId: string) {
  await requireAdminUser();
  const supabase = createSupabaseAdminClient();

  try {
    const { candidate, interview } = await getInterviewContext(candidateId);

    if (interview.interview_status === "completed") {
      await markInterviewCompleted({
        candidateId: candidate.id,
        interviewId: interview.id
      });
      revalidatePath(candidatePath(candidate.id));
      redirect(`${candidatePath(candidate.id)}?interview=completed`);
    }

    if (interview.interview_status !== "scheduled") {
      throw new Error("Interview completion can be simulated only after an interview is scheduled.");
    }

    const [
      { data: role, error: roleError },
      { data: screeningResult },
      { data: researchProfile }
    ] = await Promise.all([
      supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>(),
      supabase
        .from("screening_results")
        .select("*")
        .eq("candidate_id", candidate.id)
        .maybeSingle<ScreeningResultRecord>(),
      supabase
        .from("research_profiles")
        .select("*")
        .eq("candidate_id", candidate.id)
        .maybeSingle<ResearchProfileRecord>()
    ]);

    if (roleError || !role) {
      throw new Error(`Failed to load role for simulated interview: ${roleError?.message ?? "Role not found"}`);
    }

    const transcriptText = buildSimulatedInterviewTranscript({
      candidate,
      role,
      screeningResult: screeningResult ?? null,
      researchProfile: researchProfile ?? null
    });
    const targetModelName = getGeminiModel();
    const inputFingerprint = buildInterviewSummaryFingerprint({
      candidateName: candidate.full_name,
      roleTitle: role.title,
      transcriptText,
      modelName: targetModelName
    });
    const { data: existingTranscript } = await supabase
      .from("interview_transcripts")
      .select("*")
      .eq("interview_id", interview.id)
      .maybeSingle<InterviewTranscriptRecord>();
    const canReuseSummary =
      existingTranscript?.input_fingerprint === inputFingerprint &&
      existingTranscript.prompt_version === INTERVIEW_SUMMARY_PROMPT_VERSION;
    let summary;
    let modelName = "deterministic-fallback";
    let reusedCachedArtifact = false;

    if (canReuseSummary) {
      summary = {
        overall_assessment: existingTranscript.overall_assessment,
        strengths_observed: existingTranscript.strengths_observed,
        concerns_observed: existingTranscript.concerns_observed,
        key_topics_discussed: existingTranscript.key_topics_discussed,
        recommended_follow_up: existingTranscript.recommended_follow_up,
        concise_summary: existingTranscript.concise_summary
      };
      modelName = existingTranscript.model_name;
      reusedCachedArtifact = true;
    } else {
      try {
        const generated = await summarizeInterviewTranscript({
          candidateName: candidate.full_name,
          roleTitle: role.title,
          transcriptText
        });
        summary = generated.summary;
        modelName = generated.modelName;
      } catch (error) {
        if (!isRecoverableGeminiAvailabilityError(error)) {
          throw error;
        }

        // QA should not be blocked by temporary Gemini quota/high-demand errors.
        // The transcript remains real app data; this fallback summary is clearly
        // labeled by model_name and can be regenerated later if needed.
        console.warn("Gemini interview summary unavailable; using deterministic fallback", error);
        summary = buildDeterministicInterviewSummary({
          candidateName: candidate.full_name,
          roleTitle: role.title
        });
      }
    }
    const completedAt = new Date().toISOString();

    const { error: transcriptError } = await supabase.from("interview_transcripts").upsert(
      {
        candidate_id: candidate.id,
        interview_id: interview.id,
        transcript_text: transcriptText,
        transcript_source: "simulated",
        overall_assessment: summary.overall_assessment,
        strengths_observed: summary.strengths_observed,
        concerns_observed: summary.concerns_observed,
        key_topics_discussed: summary.key_topics_discussed,
        recommended_follow_up: summary.recommended_follow_up,
        concise_summary: summary.concise_summary,
        model_name: modelName,
        input_fingerprint: inputFingerprint,
        prompt_version: INTERVIEW_SUMMARY_PROMPT_VERSION,
        generated_at: reusedCachedArtifact
          ? existingTranscript?.generated_at ?? existingTranscript?.updated_at ?? completedAt
          : completedAt,
        completed_at: reusedCachedArtifact ? existingTranscript?.completed_at ?? completedAt : completedAt
      },
      { onConflict: "interview_id" }
    );

    if (transcriptError) {
      throw new Error(`Failed to store simulated interview transcript: ${transcriptError.message}`);
    }

    await markInterviewCompleted({
      candidateId: candidate.id,
      interviewId: interview.id
    });

    await writeAuditLog(
      candidate.id,
      "interview_simulated_completed",
      reusedCachedArtifact
        ? "Admin recorded interview completion using the cached interview summary."
        : "Admin recorded interview completion and generated an interview summary from a simulated transcript."
    );

    revalidatePath(candidatePath(candidate.id));
    redirect(`${candidatePath(candidate.id)}?interview=completed`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to simulate interview completion.";
    redirect(`${candidatePath(candidateId)}?interviewError=${encodeURIComponent(message)}`);
  }
}

export async function saveInterviewFeedbackAction(candidateId: string, formData: FormData) {
  await requireAdminUser();
  const supabase = createSupabaseAdminClient();
  const rating = Number(formData.get("rating"));
  const comments = String(formData.get("comments") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`${candidatePath(candidateId)}?feedbackError=${encodeURIComponent("Rating must be between 1 and 5.")}`);
  }

  if (comments.length < 5) {
    redirect(`${candidatePath(candidateId)}?feedbackError=${encodeURIComponent("Feedback comments must be at least 5 characters.")}`);
  }

  try {
    const { candidate, interview } = await getInterviewContext(candidateId);

    if (interview.interview_status !== "completed") {
      throw new Error("Feedback can be submitted only after the interview is completed.");
    }

    // One latest feedback record keeps the MVP simple. Re-submission updates
    // the same interview feedback row instead of creating committee workflows.
    const { error } = await supabase.from("interview_feedback").upsert(
      {
        candidate_id: candidate.id,
        interview_id: interview.id,
        rating,
        comments,
        actor: "admin",
        submitted_at: new Date().toISOString()
      },
      { onConflict: "interview_id" }
    );

    if (error) {
      throw new Error(`Failed to save interview feedback: ${error.message}`);
    }

    await writeAuditLog(
      candidate.id,
      "interview_feedback_saved",
      `Interview feedback saved with rating ${rating}/5.`
    );

    revalidatePath(candidatePath(candidate.id));
    redirect(`${candidatePath(candidate.id)}?feedback=saved`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to save interview feedback.";
    redirect(`${candidatePath(candidateId)}?feedbackError=${encodeURIComponent(message)}`);
  }
}
