"use server";

/**
 * Server actions for interview scheduling. Admin actions create options and
 * candidate actions consume a tokenized link to confirm or reschedule.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminUser } from "@/lib/auth/authorization";
import { sendInterviewConfirmationEmail } from "@/lib/email/send-interview-confirmation-email";
import { sendSchedulingOfferEmail } from "@/lib/email/send-scheduling-offer-email";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  approveAndSendRescheduleSlots,
  createConfirmedCalendarEvent,
  getInterviewConfirmationEmailContext,
  getSchedulingOfferEmailContext,
  offerInterviewSlots,
  regenerateRescheduleSuggestions,
  requestInterviewReschedule
} from "@/lib/scheduling/workflow";
import { getOptionalEnv } from "@/lib/utils/env";

function adminCandidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

function interviewSelectionPath(selectionToken: string) {
  return `/interview/${selectionToken}`;
}

export async function offerInterviewSlotsAction(candidateId: string) {
  await requireAdminUser();

  try {
    const { selectionToken, expiresAt } = await offerInterviewSlots(candidateId);
    const appBaseUrl = getOptionalEnv("APP_BASE_URL") ?? "http://localhost:3000";
    const schedulingLink = `${appBaseUrl}${interviewSelectionPath(selectionToken)}`;
    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailError: string | null = null;

    try {
      const emailContext = await getSchedulingOfferEmailContext(candidateId);
      const delivery = await sendSchedulingOfferEmail({
        candidateName: emailContext.candidateName,
        candidateEmail: emailContext.candidateEmail,
        roleTitle: emailContext.roleTitle,
        interviewerName: emailContext.interviewerName,
        schedulingLink,
        expiresAt: emailContext.expiresAt ?? expiresAt
      });
      emailStatus = delivery.status;
      emailError = "error" in delivery ? delivery.error ?? null : null;
    } catch (error) {
      emailStatus = "failed";
      emailError =
        error instanceof Error ? error.message : "Unknown scheduling offer email error.";
    }

    revalidatePath("/admin");
    revalidatePath(adminCandidatePath(candidateId));
    redirect(
      `${adminCandidatePath(candidateId)}?scheduling=offered&selectionToken=${encodeURIComponent(selectionToken)}&offerEmail=${encodeURIComponent(emailStatus)}${
        emailError ? `&offerEmailError=${encodeURIComponent(emailError)}` : ""
      }`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to offer interview slots.";
    redirect(`${adminCandidatePath(candidateId)}?schedulingError=${encodeURIComponent(message)}`);
  }
}

export async function confirmInterviewSlotAction(selectionToken: string, formData: FormData) {
  const holdId = String(formData.get("holdId") ?? "");
  const supabase = createSupabaseAdminClient();

  try {
    const { data: selectedHold, error: holdError } = await supabase
      .from("calendar_holds")
      .select("candidate_id, interview_id")
      .eq("id", holdId)
      .eq("selection_token", selectionToken)
      .maybeSingle<{ candidate_id: string; interview_id: string }>();

    if (holdError || !selectedHold) {
      throw new Error(holdError?.message ?? "Selected slot could not be found.");
    }

    const { error: confirmError } = await supabase.rpc("confirm_calendar_hold", {
      p_selection_token: selectionToken,
      p_hold_id: holdId
    });

    if (confirmError) {
      throw new Error(confirmError.message);
    }

    let calendarEventWarning: string | null = null;
    let confirmationEmailStatus: "sent" | "failed" | "skipped" = "skipped";
    let confirmationEmailError: string | null = null;
    let calendarTimezone = "America/New_York";
    let calendarInviteCreated = false;

    try {
      const calendarEvent = await createConfirmedCalendarEvent(
        selectedHold.candidate_id,
        selectedHold.interview_id
      );
      calendarTimezone = calendarEvent.timezone;
      calendarEventWarning = calendarEvent.warning?.candidateMessage ?? null;
      calendarInviteCreated = calendarEvent.warning === null && calendarEvent.eventId !== null;
    } catch {
      calendarEventWarning =
        "Your slot was confirmed, but the calendar invite could not be created automatically. The hiring team has been notified and will follow up if needed.";
    }

    try {
      const emailContext = await getInterviewConfirmationEmailContext(
        selectedHold.candidate_id,
        selectedHold.interview_id
      );
      const delivery = await sendInterviewConfirmationEmail({
        candidateName: emailContext.candidateName,
        candidateEmail: emailContext.candidateEmail,
        roleTitle: emailContext.roleTitle,
        interviewerName: emailContext.interviewerName,
        scheduledStart: emailContext.scheduledStart,
        scheduledEnd: emailContext.scheduledEnd,
        timezone: calendarTimezone,
        meetingLink: emailContext.meetingLink,
        calendarInviteCreated
      });
      confirmationEmailStatus = delivery.status;
      confirmationEmailError = "error" in delivery ? delivery.error ?? null : null;
    } catch (error) {
      confirmationEmailStatus = "failed";
      confirmationEmailError =
        error instanceof Error ? error.message : "Unknown interview confirmation email error.";
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      candidate_id: selectedHold.candidate_id,
      action_type: "interview_slot_confirmed",
      action_detail:
        calendarEventWarning || confirmationEmailStatus === "failed"
          ? `Candidate confirmed an interview slot. ${
              calendarEventWarning
                ? "Google Calendar invite creation needs follow-up. "
                : ""
            }${
              confirmationEmailStatus === "failed"
                ? `Confirmation email failed. ${confirmationEmailError ?? ""}`
                : ""
            }`.trim()
          : "Candidate confirmed one of the offered interview slots, Google Calendar sent the invite, and the confirmation email was sent.",
      actor: "candidate"
    });

    if (auditError) {
      console.error("Failed to write interview confirmation audit log", auditError);
    }

    revalidatePath("/admin");
    revalidatePath(adminCandidatePath(selectedHold.candidate_id));
    revalidatePath(interviewSelectionPath(selectionToken));
    redirect(
      `${interviewSelectionPath(selectionToken)}?scheduled=1${
        calendarEventWarning
          ? `&warning=${encodeURIComponent(calendarEventWarning)}`
          : ""
      }&confirmationEmail=${encodeURIComponent(confirmationEmailStatus)}${
        confirmationEmailError
          ? `&confirmationEmailError=${encodeURIComponent(confirmationEmailError)}`
          : ""
      }`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to confirm interview slot.";
    redirect(`${interviewSelectionPath(selectionToken)}?error=${encodeURIComponent(message)}`);
  }
}

export async function requestInterviewRescheduleAction(
  selectionToken: string,
  formData: FormData
) {
  const note = String(formData.get("note") ?? "").trim();

  if (note.length < 5) {
    redirect(
      `${interviewSelectionPath(selectionToken)}?error=${encodeURIComponent("Please provide a short note so the team knows why you need a different time.")}`
    );
  }

  try {
    await requestInterviewReschedule(selectionToken, note);
    revalidatePath("/admin");
    revalidatePath(interviewSelectionPath(selectionToken));
    redirect(`${interviewSelectionPath(selectionToken)}?reschedule=1`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to submit the reschedule request.";
    redirect(`${interviewSelectionPath(selectionToken)}?error=${encodeURIComponent(message)}`);
  }
}

export async function regenerateRescheduleSuggestionsAction(candidateId: string) {
  await requireAdminUser();

  try {
    const { selectionToken } = await regenerateRescheduleSuggestions(candidateId);
    revalidatePath("/admin");
    revalidatePath(adminCandidatePath(candidateId));
    redirect(
      `${adminCandidatePath(candidateId)}?scheduling=reschedule_regenerated&selectionToken=${encodeURIComponent(selectionToken)}`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to regenerate replacement interview slots.";
    redirect(`${adminCandidatePath(candidateId)}?schedulingError=${encodeURIComponent(message)}`);
  }
}

export async function approveRescheduleSlotsAction(candidateId: string) {
  await requireAdminUser();

  try {
    const { selectionToken, expiresAt } = await approveAndSendRescheduleSlots(candidateId);
    const appBaseUrl = getOptionalEnv("APP_BASE_URL") ?? "http://localhost:3000";
    const schedulingLink = `${appBaseUrl}${interviewSelectionPath(selectionToken)}`;
    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailError: string | null = null;

    try {
      const emailContext = await getSchedulingOfferEmailContext(candidateId);
      const delivery = await sendSchedulingOfferEmail({
        candidateName: emailContext.candidateName,
        candidateEmail: emailContext.candidateEmail,
        roleTitle: emailContext.roleTitle,
        interviewerName: emailContext.interviewerName,
        schedulingLink,
        expiresAt: emailContext.expiresAt ?? expiresAt
      });
      emailStatus = delivery.status;
      emailError = "error" in delivery ? delivery.error ?? null : null;
    } catch (error) {
      emailStatus = "failed";
      emailError =
        error instanceof Error ? error.message : "Unknown reschedule offer email error.";
    }

    revalidatePath("/admin");
    revalidatePath(adminCandidatePath(candidateId));
    redirect(
      `${adminCandidatePath(candidateId)}?scheduling=reschedule_sent&selectionToken=${encodeURIComponent(selectionToken)}&offerEmail=${encodeURIComponent(emailStatus)}${
        emailError ? `&offerEmailError=${encodeURIComponent(emailError)}` : ""
      }`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to approve replacement interview slots.";
    redirect(`${adminCandidatePath(candidateId)}?schedulingError=${encodeURIComponent(message)}`);
  }
}
