/**
 * Phase 05 offer delivery email. The offer row and signing token remain the
 * source of truth; Resend is a best-effort candidate communication channel.
 */
import { Resend } from "resend";
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";

type SendOfferEmailParams = {
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  signingLink: string;
};

export async function sendOfferEmail({
  candidateName,
  candidateEmail,
  roleTitle,
  signingLink
}: SendOfferEmailParams) {
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
      subject: `Your offer letter for ${roleTitle}`,
      text: `Hi ${candidateName},

We are excited to share your offer letter for the ${roleTitle} role at Niural.

Please review and sign your offer here:
${signingLink}

Best,
Niural Hiring Team`
    });

    if (result.error) {
      return { status: "failed" as const, error: result.error.message };
    }

    return { status: "sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown offer email error";
    return { status: "failed" as const, error: message };
  }
}
