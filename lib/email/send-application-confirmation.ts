/**
 * Thin email integration for Phase A. Confirmation delivery is intentionally
 * best-effort: the application should stay saved even if Resend is unavailable
 * or the provider call fails.
 */
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";
import { Resend } from "resend";

type SendConfirmationEmailParams = {
  candidateName: string;
  roleTitle: string;
  email: string;
};

/**
 * Sends the confirmation email when Resend is configured, or returns a
 * structured "skipped" result when email is disabled in local/dev environments.
 */
export async function sendApplicationConfirmationEmail({
  candidateName,
  roleTitle,
  email,
}: SendConfirmationEmailParams) {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");

  if (!apiKey || !fromEmail) {
    return { status: "skipped" as const, error: "Resend is not configured." };
  }

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: getRequiredEnv("RESEND_FROM_EMAIL"),
      to: email,
      subject: `Application received for ${roleTitle}`,
      text: `Hi ${candidateName},

Thanks for applying to the ${roleTitle} role at Niural. We received your application and our team will review it shortly.

Best,
Niural Hiring Team`,
    });

    if (result.error) {
      return { status: "failed" as const, error: result.error.message };
    }

    return { status: "sent" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown email error";
    return { status: "failed" as const, error: message };
  }
}
