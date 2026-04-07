/**
 * Immediate Phase 05 signing alert. This is intentionally separate from the
 * candidate signing state because email delivery should not decide whether an
 * offer is legally/workflow signed.
 */
import { Resend } from "resend";
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";

type SendOfferSignedAlertEmailParams = {
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  signedAt: string;
};

function getAlertRecipient() {
  return (
    getOptionalEnv("OFFER_ALERT_EMAIL") ??
    getOptionalEnv("GOOGLE_CALENDAR_INTERVIEWER_EMAIL") ??
    getOptionalEnv("RESEND_FROM_EMAIL")
  );
}

export async function sendOfferSignedAlertEmail({
  candidateName,
  candidateEmail,
  roleTitle,
  signedAt
}: SendOfferSignedAlertEmailParams) {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const fromEmail = getOptionalEnv("RESEND_FROM_EMAIL");
  const alertRecipient = getAlertRecipient();

  if (!apiKey || !fromEmail || !alertRecipient) {
    return { status: "skipped" as const, error: "Offer alert email is not configured." };
  }

  const resend = new Resend(apiKey);
  const signedAtText = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(signedAt));

  try {
    const result = await resend.emails.send({
      from: getRequiredEnv("RESEND_FROM_EMAIL"),
      to: alertRecipient,
      subject: `Offer signed: ${candidateName}`,
      text: `${candidateName} signed the offer for ${roleTitle}.

Candidate email: ${candidateEmail}
Signed at: ${signedAtText}

Open the admin candidate profile to review the signed offer.`
    });

    if (result.error) {
      return { status: "failed" as const, error: result.error.message };
    }

    return { status: "sent" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown offer signed alert email error";
    return { status: "failed" as const, error: message };
  }
}
