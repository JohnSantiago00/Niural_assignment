/**
 * Phase 03 scheduling workflow. The core design principle is that holds live
 * in the database and are treated as the source of truth for slot conflicts.
 * That keeps offering, confirming, and expiring interview options explicit.
 */
import crypto from "node:crypto";
import {
  createCalendarInterviewEvent,
  isGoogleCalendarSideEffectError,
  normalizeGoogleCalendarWarning
} from "@/lib/scheduling/google-calendar";
import { interpretReschedulePreferences } from "@/lib/scheduling/reschedule-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { generateInterviewSlots } from "@/lib/scheduling/availability";
import type {
  CalendarHoldRecord,
  CandidateRecord,
  InterviewRecord,
  ReschedulePreferences
} from "@/types/database";

const HOLD_DURATION_HOURS = 48;
const MINIMUM_OFFERED_SLOTS = 3;
const MAXIMUM_OFFERED_SLOTS = 5;

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function createSelectionToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function canOfferInterviewSlots(candidate: Pick<CandidateRecord, "current_status">) {
  return ["shortlisted", "interview_pending", "interview_scheduled"].includes(candidate.current_status);
}

async function expireExistingHolds() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("expire_calendar_holds");

  if (error) {
    throw new Error(`Failed to expire scheduling holds: ${error.message}`);
  }
}

async function getCandidateForScheduling(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle<CandidateRecord>();

  if (error || !candidate) {
    throw new Error(`Failed to load candidate for scheduling: ${error?.message ?? "Candidate not found"}`);
  }

  if (!canOfferInterviewSlots(candidate)) {
    throw new Error("Interview slots can be offered only after the candidate is shortlisted.");
  }

  return candidate;
}

async function getInterviewByCandidate(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle<InterviewRecord>();

  if (error || !interview) {
    throw new Error(`Failed to load interview: ${error?.message ?? "Interview not found"}`);
  }

  return interview;
}

async function getOrCreateInterview(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: existingInterview, error: existingInterviewError } = await supabase
    .from("interviews")
    .select("*")
    .eq("candidate_id", candidateId)
    .maybeSingle<InterviewRecord>();

  if (existingInterviewError) {
    throw new Error(`Failed to load interview: ${existingInterviewError.message}`);
  }

  if (existingInterview) {
    return existingInterview;
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .insert({
      candidate_id: candidateId,
      interview_status: "pending"
    })
    .select("*")
    .single<InterviewRecord>();

  if (interviewError || !interview) {
    throw new Error(`Failed to create interview: ${interviewError?.message ?? "Unknown error"}`);
  }

  return interview;
}

async function getActiveHolds() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("calendar_holds")
    .select("*")
    .in("hold_status", ["held", "confirmed"]);

  if (error) {
    throw new Error(`Failed to load active calendar holds: ${error.message}`);
  }

  return data ?? [];
}

async function releaseOpenHoldsForInterview(interviewId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("calendar_holds")
    .update({
      hold_status: "released"
    })
    .eq("interview_id", interviewId)
    .eq("hold_status", "held");

  if (error) {
    throw new Error(`Failed to release previous interview holds: ${error.message}`);
  }
}

async function getActiveHoldsForInterview(interviewId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("calendar_holds")
    .select("*")
    .eq("interview_id", interviewId)
    .eq("hold_status", "held")
    .order("slot_start", { ascending: true });

  if (error) {
    throw new Error(`Failed to load current interview holds: ${error.message}`);
  }

  return (data ?? []) as CalendarHoldRecord[];
}

async function insertHolds({
  candidateId,
  interviewId,
  preferences = null
}: {
  candidateId: string;
  interviewId: string;
  preferences?: ReschedulePreferences | null;
}) {
  const supabase = createSupabaseAdminClient();
  const activeHolds = await getActiveHolds();
  const candidateSlots = await generateInterviewSlots(activeHolds, preferences);
  const selectionToken = createSelectionToken();
  const expiresAt = addHours(new Date(), HOLD_DURATION_HOURS).toISOString();
  const insertedHoldIds: string[] = [];

  for (const slot of candidateSlots) {
    if (insertedHoldIds.length >= MAXIMUM_OFFERED_SLOTS) {
      break;
    }

    const { data: insertedHold, error } = await supabase
      .from("calendar_holds")
      .insert({
        candidate_id: candidateId,
        interview_id: interviewId,
        interviewer_name: slot.interviewerName,
        interviewer_email: slot.interviewerEmail,
        slot_start: slot.start,
        slot_end: slot.end,
        expires_at: expiresAt,
        selection_token: selectionToken
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      // The exclusion constraint protects overlap conflicts. If another hold
      // claimed the slot between generation and insert, skip it and keep going.
      if (
        error.message.includes("calendar_holds_no_active_overlap") ||
        error.message.includes("conflicting key value")
      ) {
        continue;
      }

      throw new Error(`Failed to create calendar hold: ${error.message}`);
    }

    if (insertedHold?.id) {
      insertedHoldIds.push(insertedHold.id);
    }
  }

  if (insertedHoldIds.length < MINIMUM_OFFERED_SLOTS) {
    await supabase
      .from("calendar_holds")
      .update({
        hold_status: "released"
      })
      .in("id", insertedHoldIds);

    throw new Error("Unable to reserve enough conflict-free interview slots. Please try again.");
  }

  return {
    selectionToken,
    expiresAt
  };
}

async function refreshInterviewAfterOffering(interviewId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("interviews")
    .update({
      interview_status: "options_sent",
      interviewer_name: null,
      interviewer_email: null,
      scheduled_start: null,
      scheduled_end: null,
      meeting_link: null,
      calendar_event_id: null,
      calendar_warning: null
    })
    .eq("id", interviewId);

  if (error) {
    throw new Error(`Failed to update interview scheduling state: ${error.message}`);
  }
}

async function saveCalendarWarning(interviewId: string, warning: string | null) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("interviews")
    .update({
      calendar_warning: warning
    })
    .eq("id", interviewId);

  if (error) {
    console.error("Failed to store calendar warning", error);
  }
}

async function markCandidateInterviewPending(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("candidates")
    .update({
      current_status: "interview_pending"
    })
    .eq("id", candidateId);

  if (error) {
    throw new Error(`Failed to update candidate scheduling status: ${error.message}`);
  }
}

async function writeAuditLog(candidateId: string, actionType: string, actionDetail: string, actor: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    candidate_id: candidateId,
    action_type: actionType,
    action_detail: actionDetail,
    actor
  });

  if (error) {
    console.error("Failed to write scheduling audit log", error);
  }
}

export async function offerInterviewSlots(candidateId: string) {
  await expireExistingHolds();
  const candidate = await getCandidateForScheduling(candidateId);
  const interview = await getOrCreateInterview(candidate.id);

  if (
    candidate.current_status === "interview_scheduled" &&
    interview.interview_status !== "reschedule_requested"
  ) {
    throw new Error("This candidate already has a scheduled interview.");
  }

  await releaseOpenHoldsForInterview(interview.id);
  const { selectionToken, expiresAt } = await insertHolds({
    candidateId: candidate.id,
    interviewId: interview.id
  });

  await refreshInterviewAfterOffering(interview.id);
  await markCandidateInterviewPending(candidate.id);
  await writeAuditLog(
    candidate.id,
    "interview_slots_offered",
    "Interview slot options were generated and reserved for candidate selection.",
    "admin"
  );

  return {
    interviewId: interview.id,
    selectionToken,
    expiresAt
  };
}

export async function requestInterviewReschedule(selectionToken: string, note: string) {
  const supabase = createSupabaseAdminClient();
  await expireExistingHolds();

  const { data: holds, error: holdsError } = await supabase
    .from("calendar_holds")
    .select("*")
    .eq("selection_token", selectionToken);

  if (holdsError || !holds || holds.length === 0) {
    throw new Error("Scheduling link was not found or is no longer active.");
  }

  const candidateId = holds[0].candidate_id;
  const interviewId = holds[0].interview_id;
  const parsedPreferences = await interpretReschedulePreferences(note.trim());

  const { error: releaseError } = await supabase
    .from("calendar_holds")
    .update({
      hold_status: "released"
    })
    .eq("interview_id", interviewId)
    .in("hold_status", ["held", "confirmed"]);

  if (releaseError) {
    throw new Error(`Failed to release current scheduling holds: ${releaseError.message}`);
  }

  const { error: interviewError } = await supabase
    .from("interviews")
    .update({
      interview_status: "reschedule_requested",
      scheduled_start: null,
      scheduled_end: null,
      interviewer_name: null,
      interviewer_email: null,
      meeting_link: null,
      calendar_event_id: null,
      calendar_warning: null,
      scheduling_note: note.trim(),
      reschedule_preferences: parsedPreferences
    })
    .eq("id", interviewId);

  if (interviewError) {
    throw new Error(`Failed to update interview reschedule state: ${interviewError.message}`);
  }

  const { error: candidateError } = await supabase
    .from("candidates")
    .update({
      current_status: "interview_pending"
    })
    .eq("id", candidateId);

  if (candidateError) {
    throw new Error(`Failed to update candidate status after reschedule request: ${candidateError.message}`);
  }

  await writeAuditLog(
    candidateId,
    "interview_reschedule_requested",
    `Candidate requested a new interview time. Note: ${note.trim()}`,
    "candidate"
  );
}

export async function regenerateRescheduleSuggestions(candidateId: string) {
  await expireExistingHolds();
  const candidate = await getCandidateForScheduling(candidateId);
  const interview = await getInterviewByCandidate(candidate.id);

  if (interview.interview_status !== "reschedule_requested") {
    throw new Error("Replacement interview slots can be generated only after a reschedule request.");
  }

  await releaseOpenHoldsForInterview(interview.id);
  const { selectionToken, expiresAt } = await insertHolds({
    candidateId: candidate.id,
    interviewId: interview.id,
    preferences: interview.reschedule_preferences
  });

  await writeAuditLog(
    candidate.id,
    "interview_reschedule_slots_regenerated",
    "Replacement interview slot suggestions were regenerated for admin review.",
    "admin"
  );

  return {
    interviewId: interview.id,
    selectionToken,
    expiresAt
  };
}

export async function approveAndSendRescheduleSlots(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  await expireExistingHolds();
  const candidate = await getCandidateForScheduling(candidateId);
  const interview = await getInterviewByCandidate(candidate.id);

  if (interview.interview_status !== "reschedule_requested") {
    throw new Error("This candidate does not have a pending reschedule request.");
  }

  const activeHolds = await getActiveHoldsForInterview(interview.id);

  if (activeHolds.length === 0) {
    throw new Error("Generate replacement slots before sending the reschedule link.");
  }

  const selectionToken = activeHolds[0].selection_token;
  const expiresAt = activeHolds[0].expires_at;

  await refreshInterviewAfterOffering(interview.id);
  await markCandidateInterviewPending(candidate.id);
  await writeAuditLog(
    candidate.id,
    "interview_reschedule_slots_sent",
    "Replacement interview slots were approved and sent to the candidate.",
    "admin"
  );

  return {
    interviewId: interview.id,
    selectionToken,
    expiresAt
  };
}

export async function createConfirmedCalendarEvent(candidateId: string, interviewId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: candidate, error: candidateError }, { data: interview, error: interviewError }] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .maybeSingle<CandidateRecord>(),
      supabase
        .from("interviews")
        .select("*")
        .eq("id", interviewId)
        .maybeSingle<InterviewRecord>()
    ]);

  if (candidateError || !candidate) {
    throw new Error(`Failed to load confirmed candidate for calendar event: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (interviewError || !interview) {
    throw new Error(`Failed to load confirmed interview for calendar event: ${interviewError?.message ?? "Interview not found"}`);
  }

  if (!interview.scheduled_start || !interview.scheduled_end) {
    throw new Error("Interview slot was confirmed without a scheduled time.");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("title")
    .eq("id", candidate.role_id)
    .maybeSingle<{ title: string }>();

  if (roleError || !role) {
    throw new Error(`Failed to load role for calendar event: ${roleError?.message ?? "Role not found"}`);
  }

  try {
    const event = await createCalendarInterviewEvent({
      candidateName: candidate.full_name,
      candidateEmail: candidate.email,
      roleTitle: role.title,
      scheduledStart: interview.scheduled_start,
      scheduledEnd: interview.scheduled_end
    });

    const { error: updateError } = await supabase
      .from("interviews")
      .update({
        calendar_event_id: event.eventId,
        meeting_link: event.meetingLink,
        calendar_warning: event.warning?.adminMessage ?? null
      })
      .eq("id", interview.id);

    if (updateError) {
      throw new Error(`Failed to store Google Calendar event details: ${updateError.message}`);
    }

    await writeAuditLog(
      candidate.id,
      event.warning ? "interview_calendar_event_created_with_warning" : "interview_calendar_event_created",
      event.warning
        ? `Google Calendar event created via ${event.creationMode}, but invite delivery needs follow-up. Event ID: ${event.eventId}. ${event.warning.adminMessage}`
        : `Google Calendar event created for confirmed interview. Event ID: ${event.eventId ?? "not returned"}`,
      "system"
    );

    return event;
  } catch (error) {
    const warning = isGoogleCalendarSideEffectError(error)
      ? error.warning
      : normalizeGoogleCalendarWarning(error);
    await saveCalendarWarning(interview.id, warning.adminMessage);
    await writeAuditLog(
      candidate.id,
      "interview_calendar_event_warning",
      `Interview slot was confirmed, but calendar delivery needs manual follow-up. ${warning.adminMessage}`,
      "system"
    );

    return {
      eventId: null,
      meetingLink: null,
      timezone: "America/New_York",
      warning
    };
  }
}

export async function getSchedulingOfferEmailContext(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: candidate, error: candidateError }, { data: role, error: roleError }] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .maybeSingle<CandidateRecord>(),
      supabase
        .from("candidates")
        .select("role_id")
        .eq("id", candidateId)
        .maybeSingle<{ role_id: string }>()
    ]);

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for scheduling email: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (roleError || !role) {
    throw new Error(`Failed to load candidate role for scheduling email: ${roleError?.message ?? "Role not found"}`);
  }

  const { data: roleRecord, error: roleRecordError } = await supabase
    .from("roles")
    .select("title")
    .eq("id", role.role_id)
    .maybeSingle<{ title: string }>();

  if (roleRecordError || !roleRecord) {
    throw new Error(`Failed to load role title for scheduling email: ${roleRecordError?.message ?? "Role not found"}`);
  }

  const { data: activeHold, error: activeHoldError } = await supabase
    .from("calendar_holds")
    .select("interviewer_name, expires_at, selection_token")
    .eq("candidate_id", candidate.id)
    .eq("hold_status", "held")
    .order("slot_start", { ascending: true })
    .limit(1)
    .maybeSingle<{ interviewer_name: string; expires_at: string; selection_token: string }>();

  if (activeHoldError) {
    throw new Error(`Failed to load active scheduling hold for email: ${activeHoldError.message}`);
  }

  return {
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    roleTitle: roleRecord.title,
    interviewerName: activeHold?.interviewer_name ?? null,
    expiresAt: activeHold?.expires_at ?? null
  };
}

export async function getInterviewConfirmationEmailContext(candidateId: string, interviewId: string) {
  const supabase = createSupabaseAdminClient();
  const [{ data: candidate, error: candidateError }, { data: interview, error: interviewError }] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .maybeSingle<CandidateRecord>(),
      supabase
        .from("interviews")
        .select("*")
        .eq("id", interviewId)
        .maybeSingle<InterviewRecord>()
    ]);

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for confirmation email: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (interviewError || !interview) {
    throw new Error(`Failed to load interview for confirmation email: ${interviewError?.message ?? "Interview not found"}`);
  }

  if (!interview.scheduled_start || !interview.scheduled_end) {
    throw new Error("Interview confirmation email requires a scheduled interview time.");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("title")
    .eq("id", candidate.role_id)
    .maybeSingle<{ title: string }>();

  if (roleError || !role) {
    throw new Error(`Failed to load role for confirmation email: ${roleError?.message ?? "Role not found"}`);
  }

  return {
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    roleTitle: role.title,
    interviewerName: interview.interviewer_name,
    scheduledStart: interview.scheduled_start,
    scheduledEnd: interview.scheduled_end,
    meetingLink: interview.meeting_link
  };
}
