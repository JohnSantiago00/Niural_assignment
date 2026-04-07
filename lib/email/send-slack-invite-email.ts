/**
 * Phase 06 non-admin Slack invite fallback. Slack admin invite APIs are often
 * unavailable in prototype workspaces, so a configured workspace invite link
 * lets the candidate receive a real onboarding email while Slack lookup and
 * messaging remain real API-driven after they join.
 */
import { Resend } from "resend";
import { getOptionalEnv, getRequiredEnv } from "@/lib/utils/env";

type SendSlackInviteEmailParams = {
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  inviteUrl: string;
};

export async function sendSlackInviteEmail({
  candidateName,
  candidateEmail,
  roleTitle,
  inviteUrl
}: SendSlackInviteEmailParams) {
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
      subject: `Join the Niural Slack workspace`,
      text: `Hi ${candidateName},

Welcome again to Niural. As part of your onboarding for the ${roleTitle} role, please join our Slack workspace using this invite link:

${inviteUrl}

After you join Slack, the hiring team will send your welcome message and next steps in the workspace.

Best,
Niural Hiring Team`
    });

    if (result.error) {
      return { status: "failed" as const, error: result.error.message };
    }

    return { status: "sent" as const };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Slack invite email error";
    return { status: "failed" as const, error: message };
  }
}
