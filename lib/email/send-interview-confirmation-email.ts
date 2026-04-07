/**
 * Human-readable interview confirmation email. Google Calendar becomes the
 * calendar source of truth after confirmation, while this email acts as a
 * friendly communication layer for the candidate.
 */
import { Resend } from "resend";
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";

type SendInterviewConfirmationEmailParams = {
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  interviewerName: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  meetingLink: string | null;
  calendarInviteCreated: boolean;
};

function formatWindow(start: string, end: string, timezone: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const day = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: timezone
  }).format(startDate);
  const startTime = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: timezone
  }).format(startDate);
  const endTime = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: timezone
  }).format(endDate);

  return `${day}, ${startTime} to ${endTime} (${timezone})`;
}

export async function sendInterviewConfirmationEmail({
  candidateName,
  candidateEmail,
  roleTitle,
  interviewerName,
  scheduledStart,
  scheduledEnd,
  timezone,
  meetingLink,
  calendarInviteCreated
}: SendInterviewConfirmationEmailParams) {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");

  if (!apiKey || !fromEmail) {
    return { status: "skipped" as const, error: "Resend is not configured." };
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: getRequiredEnv("RESEND_FROM_EMAIL"),
      to: candidateEmail,
      subject: `Interview confirmed for ${roleTitle}`,
      text: `Hi ${candidateName},

Your interview for the ${roleTitle} role at Niural has been confirmed.

${interviewerName ? `Interviewer: ${interviewerName}` : ""}
When: ${formatWindow(scheduledStart, scheduledEnd, timezone)}
${meetingLink ? `Meeting link: ${meetingLink}` : ""}

${calendarInviteCreated ? "You should also receive the calendar invite separately. Please check your calendar for the official event details." : "The hiring team will follow up if a calendar invite or meeting link needs to be added manually."}

Best,
Niural Hiring Team`
    });

    if (result.error) {
      return { status: "failed" as const, error: result.error.message };
    }

    return { status: "sent" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown interview confirmation email error";
    return { status: "failed" as const, error: message };
  }
}
