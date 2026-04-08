/**
 * Scheduling-offer email. This is best-effort delivery: the slot holds remain
 * valid even if the email provider fails, because the DB hold set is the
 * actual scheduling source of truth.
 */
import { Resend } from "resend";
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";

type SendSchedulingOfferEmailParams = {
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  interviewerName: string | null;
  schedulingLink: string;
  expiresAt: string | null;
};

export async function sendSchedulingOfferEmail({
  candidateName,
  candidateEmail,
  roleTitle,
  interviewerName,
  schedulingLink,
  expiresAt
}: SendSchedulingOfferEmailParams) {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");

  if (!apiKey || !fromEmail) {
    return { status: "skipped" as const, error: "Resend is not configured." };
  }

  const resend = new Resend(apiKey);
  const expiryText = expiresAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(expiresAt))
    : null;

  try {
    const result = await resend.emails.send({
      from: getRequiredEnv("RESEND_FROM_EMAIL"),
      to: candidateEmail,
      subject: `Interview scheduling options for ${roleTitle}`,
      text: `Hi ${candidateName},

Your interview scheduling options are ready for the ${roleTitle} role at Niural.

${interviewerName ? `Interviewer: ${interviewerName}` : ""}
Scheduling link: ${schedulingLink}
${expiryText ? `Please choose a slot before ${expiryText}.` : "Please choose a slot as soon as you can because these reserved options may expire."}

Best,
Niural Hiring Team`
    });

    if (result.error) {
      return { status: "failed" as const, error: result.error.message };
    }

    return { status: "sent" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown scheduling email error";
    return { status: "failed" as const, error: message };
  }
}
