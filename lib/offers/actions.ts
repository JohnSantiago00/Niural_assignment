"use server";

/**
 * Phase 05 offer server actions. Admin actions require admin auth; the public
 * signing action only works through a valid token and never trusts client-side
 * signature-pad checks alone.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminUser } from "@/lib/auth/authorization";
import { sendOfferEmail } from "@/lib/email/send-offer-email";
import { sendOfferSignedAlertEmail } from "@/lib/email/send-offer-signed-alert-email";
import {
  generateOfferDraft,
  getOfferSigningView,
  markOfferSent,
  parseOfferInput,
  signOffer,
  updateOfferEmailDelivery
} from "@/lib/offers/workflow";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { triggerSlackOnboardingAfterOfferSigned } from "@/lib/slack/workflow";
import { getOptionalEnv } from "@/lib/utils/env";
import type { CandidateRecord, OfferRecord, RoleRecord } from "@/types/database";

function adminCandidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

function offerSigningPath(signingToken: string) {
  return `/offer/${signingToken}`;
}

async function getOfferEmailContext(offer: OfferRecord) {
  const supabase = createSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", offer.candidate_id)
    .maybeSingle<CandidateRecord>();

  if (candidateError || !candidate) {
    throw new Error(candidateError?.message ?? "Candidate not found.");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("*")
    .eq("id", candidate.role_id)
    .maybeSingle<RoleRecord>();

  if (roleError || !role) {
    throw new Error(roleError?.message ?? "Role not found.");
  }

  return { candidate, role };
}

function getRequestIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return (
    headerStore.get("x-real-ip") ??
    headerStore.get("cf-connecting-ip") ??
    null
  );
}

export async function generateOfferDraftAction(candidateId: string, formData: FormData) {
  await requireAdminUser();

  try {
    const offerInput = parseOfferInput(formData);
    const offer = await generateOfferDraft(candidateId, offerInput);
    const sentOffer = await markOfferSent(offer.id);
    const { candidate, role } = await getOfferEmailContext(sentOffer);
    const appBaseUrl = getOptionalEnv("APP_BASE_URL") ?? "http://localhost:3000";
    const signingLink = `${appBaseUrl}${offerSigningPath(sentOffer.signing_token)}`;
    const delivery = await sendOfferEmail({
      candidateName: candidate.full_name,
      candidateEmail: candidate.email,
      roleTitle: sentOffer.confirmed_job_title || role.title,
      signingLink
    });
    const emailError = "error" in delivery ? delivery.error ?? null : null;

    await updateOfferEmailDelivery(sentOffer.id, {
      status: delivery.status,
      recipient: candidate.email,
      error: emailError
    });

    revalidatePath("/admin");
    revalidatePath(adminCandidatePath(candidateId));
    redirect(
      `${adminCandidatePath(candidateId)}?offer=sent&offerDelivery=${encodeURIComponent(delivery.status)}&offerRecipient=${encodeURIComponent(candidate.email)}${
        emailError ? `&offerDeliveryError=${encodeURIComponent(emailError)}` : ""
      }`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to send offer.";
    redirect(`${adminCandidatePath(candidateId)}?offerError=${encodeURIComponent(message)}`);
  }
}

export async function signOfferAction(signingToken: string, formData: FormData) {
  const agreement = formData.get("agreement") === "on";
  const signatureImageData = String(formData.get("signatureImageData") ?? "");

  if (!agreement) {
    redirect(`${offerSigningPath(signingToken)}?error=${encodeURIComponent("Please agree to the offer terms before signing.")}`);
  }

  if (!signatureImageData.startsWith("data:image/png;base64,")) {
    redirect(`${offerSigningPath(signingToken)}?error=${encodeURIComponent("Please draw your signature before submitting.")}`);
  }

  try {
    const headerStore = await headers();
    const { offer, alreadySigned } = await signOffer({
      signingToken,
      signatureImageData,
      signerIp: getRequestIp(headerStore)
    });

    let alertStatus: "sent" | "failed" | "skipped" = "skipped";
    let alertError: string | null = null;

    if (!alreadySigned) {
      try {
        const view = await getOfferSigningView(signingToken);

        if (view) {
          const delivery = await sendOfferSignedAlertEmail({
            candidateName: view.candidate.full_name,
            candidateEmail: view.candidate.email,
            roleTitle: offer.confirmed_job_title,
            signedAt: offer.signed_at ?? new Date().toISOString()
          });
          alertStatus = delivery.status;
          alertError = "error" in delivery ? delivery.error ?? null : null;

          if (view.role) {
            // Slack onboarding starts after the durable offer signature is
            // stored. Slack invite/message failures are recorded separately so
            // they never undo a valid signed offer.
            try {
              await triggerSlackOnboardingAfterOfferSigned({
                offer,
                candidate: view.candidate,
                role: view.role
              });
            } catch (slackError) {
              console.error("Slack onboarding trigger failed after offer signing", slackError);
            }
          }
        }
      } catch (error) {
        alertStatus = "failed";
        alertError =
          error instanceof Error ? error.message : "Unknown offer signed alert error.";
      }
    }

    revalidatePath("/admin");
    revalidatePath(adminCandidatePath(offer.candidate_id));
    revalidatePath(offerSigningPath(signingToken));
    redirect(
      `${offerSigningPath(signingToken)}?signed=1&alert=${encodeURIComponent(alertStatus)}${
        alertError ? `&alertError=${encodeURIComponent(alertError)}` : ""
      }`
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to sign offer.";
    redirect(`${offerSigningPath(signingToken)}?error=${encodeURIComponent(message)}`);
  }
}
