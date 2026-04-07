/**
 * Scheduling read models for both the admin review surface and the candidate
 * selection link. Keeping them explicit avoids hiding stateful scheduling
 * rules behind generic query helpers.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  ApplicationRecord,
  CalendarHoldRecord,
  CandidateRecord,
  InterviewRecord,
  RoleRecord
} from "@/types/database";

async function expireExistingHolds() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("expire_calendar_holds");

  if (error) {
    console.error("Failed to expire calendar holds before scheduling query", error);
  }
}

export async function getCandidateSchedulingDetail(candidateId: string) {
  await expireExistingHolds();
  const supabase = createSupabaseAdminClient();
  const [{ data: interview, error: interviewError }, { data: holds, error: holdsError }] =
    await Promise.all([
      supabase
        .from("interviews")
        .select("*")
        .eq("candidate_id", candidateId)
        .maybeSingle<InterviewRecord>(),
      supabase
        .from("calendar_holds")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("slot_start", { ascending: true })
    ]);

  if (interviewError) {
    throw new Error(`Failed to load interview details: ${interviewError.message}`);
  }

  if (holdsError) {
    throw new Error(`Failed to load interview holds: ${holdsError.message}`);
  }

  return {
    interview: interview ?? null,
    calendarHolds: (holds ?? []) as CalendarHoldRecord[]
  };
}

export async function getInterviewSelectionView(selectionToken: string) {
  await expireExistingHolds();
  const supabase = createSupabaseAdminClient();
  const { data: holds, error: holdsError } = await supabase
    .from("calendar_holds")
    .select("*")
    .eq("selection_token", selectionToken)
    .order("slot_start", { ascending: true });

  if (holdsError) {
    throw new Error(`Failed to load interview options: ${holdsError.message}`);
  }

  if (!holds || holds.length === 0) {
    return null;
  }

  const firstHold = holds[0] as CalendarHoldRecord;
  const [
    { data: candidate, error: candidateError },
    { data: interview, error: interviewError }
  ] = await Promise.all([
    supabase
      .from("candidates")
      .select("*")
      .eq("id", firstHold.candidate_id)
      .maybeSingle<CandidateRecord>(),
    supabase
      .from("interviews")
      .select("*")
      .eq("id", firstHold.interview_id)
      .maybeSingle<InterviewRecord>()
  ]);

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for interview selection: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (interviewError || !interview) {
    throw new Error(`Failed to load interview selection state: ${interviewError?.message ?? "Interview not found"}`);
  }

  const [{ data: application }, { data: role }] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("id", candidate.application_id)
      .maybeSingle<ApplicationRecord>(),
    supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>()
  ]);

  const activeHolds = (holds as CalendarHoldRecord[]).filter(
    (hold) => hold.hold_status === "held" && new Date(hold.expires_at) > new Date()
  );
  const confirmedHold =
    (holds as CalendarHoldRecord[]).find((hold) => hold.hold_status === "confirmed") ?? null;
  const expiredHoldCount = (holds as CalendarHoldRecord[]).filter(
    (hold) => hold.hold_status === "expired"
  ).length;

  return {
    selectionToken,
    candidate,
    application: application ?? null,
    role: role ?? null,
    interview,
    holds: holds as CalendarHoldRecord[],
    activeHolds,
    confirmedHold,
    expiredHoldCount
  };
}
