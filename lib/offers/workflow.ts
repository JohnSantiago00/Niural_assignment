/**
 * Phase 05 offer workflow helpers. These functions keep signing/generation
 * deterministic: Gemini drafts text, but app code validates eligibility,
 * creates tokens, sends offers, and records signatures.
 */
import crypto from "node:crypto";
import { generateOfferLetterDraft } from "@/lib/gemini/generate-offer-letter";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CandidateRecord,
  OfferRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord,
  InterviewTranscriptRecord
} from "@/types/database";

export type OfferInput = {
  confirmedJobTitle: string;
  startDate: string;
  baseSalary: string;
  equityOrBonus: string | null;
  reportingManager: string;
  customTerms: string | null;
};

export type OfferSigningView = {
  offer: OfferRecord;
  candidate: CandidateRecord;
  role: RoleRecord | null;
};

function generateSigningToken() {
  return crypto.randomBytes(24).toString("hex");
}

function nextCalendarDate(value: string) {
  const date = new Date(value);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requireText(value: FormDataEntryValue | null, label: string) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function requireDate(value: FormDataEntryValue | null) {
  const text = requireText(value, "Start date");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Start date must use YYYY-MM-DD format.");
  }

  return text;
}

export function parseOfferInput(formData: FormData): OfferInput {
  return {
    confirmedJobTitle: requireText(formData.get("confirmedJobTitle"), "Confirmed job title"),
    startDate: requireDate(formData.get("startDate")),
    baseSalary: requireText(formData.get("baseSalary"), "Base salary"),
    equityOrBonus: normalizeText(formData.get("equityOrBonus")),
    reportingManager: requireText(formData.get("reportingManager"), "Reporting manager"),
    customTerms: normalizeText(formData.get("customTerms"))
  };
}

async function writeAuditLog(candidateId: string, actionType: string, actionDetail: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    candidate_id: candidateId,
    action_type: actionType,
    action_detail: actionDetail,
    actor: "admin"
  });

  if (error) {
    console.error("Failed to write offer audit log", error);
  }
}

async function getOfferContext(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle<CandidateRecord>();

  if (candidateError || !candidate) {
    throw new Error(candidateError?.message ?? "Candidate not found.");
  }

  const [
    { data: role, error: roleError },
    { data: screeningResult },
    { data: researchProfile },
    { data: interviewTranscript }
  ] = await Promise.all([
    supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>(),
    supabase
      .from("screening_results")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<ScreeningResultRecord>(),
    supabase
      .from("research_profiles")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<ResearchProfileRecord>(),
    supabase
      .from("interview_transcripts")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<InterviewTranscriptRecord>()
  ]);

  if (roleError || !role) {
    throw new Error(roleError?.message ?? "Role not found.");
  }

  return {
    candidate,
    role,
    screeningResult: screeningResult ?? null,
    researchProfile: researchProfile ?? null,
    interviewTranscript: interviewTranscript ?? null
  };
}

export function isOfferEligible(candidate: CandidateRecord) {
  return ["interview_completed", "offer_drafted", "offer_sent", "offer_signed"].includes(
    candidate.current_status
  );
}

export async function generateOfferDraft(candidateId: string, input: OfferInput) {
  const supabase = createSupabaseAdminClient();
  const { candidate, role, screeningResult, researchProfile, interviewTranscript } =
    await getOfferContext(candidateId);

  if (!isOfferEligible(candidate)) {
    throw new Error("Offer generation is available after interview completion.");
  }

  const { data: existingOffer } = await supabase
    .from("offers")
    .select("*")
    .eq("candidate_id", candidate.id)
    .maybeSingle<OfferRecord>();

  if (existingOffer?.offer_status === "signed") {
    throw new Error("Signed offers cannot be regenerated.");
  }

  if (!interviewTranscript || input.startDate < nextCalendarDate(interviewTranscript.completed_at)) {
    throw new Error("Start date must be after the interview date.");
  }

  const { letter, modelName } = await generateOfferLetterDraft({
    candidateName: candidate.full_name,
    roleTitle: role.title,
    team: role.team,
    screeningSummary: screeningResult?.rationale ?? null,
    interviewSummary: interviewTranscript?.concise_summary ?? researchProfile?.candidate_brief ?? null,
    confirmedJobTitle: input.confirmedJobTitle,
    startDate: input.startDate,
    baseSalary: input.baseSalary,
    equityOrBonus: input.equityOrBonus,
    reportingManager: input.reportingManager,
    customTerms: input.customTerms
  });

  const signingToken = generateSigningToken();
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .upsert(
      {
        candidate_id: candidate.id,
        application_id: candidate.application_id,
        offer_status: "ready",
        confirmed_job_title: input.confirmedJobTitle,
        start_date: input.startDate,
        base_salary: input.baseSalary,
        compensation_structure: "Full-time",
        equity_or_bonus: input.equityOrBonus,
        reporting_manager: input.reportingManager,
        custom_terms: input.customTerms,
        generated_letter: letter,
        generated_model_name: modelName,
        signing_token: signingToken,
        signing_token_expires_at: null,
        offer_email_status: null,
        offer_email_error: null,
        offer_email_recipient: null,
        sent_at: null,
        signed_at: null,
        signer_ip: null,
        signer_name: null,
        signature_image_data: null
      },
      { onConflict: "candidate_id" }
    )
    .select("*")
    .single<OfferRecord>();

  if (offerError) {
    throw new Error(`Failed to save offer draft: ${offerError.message}`);
  }

  await supabase
    .from("candidates")
    .update({ current_status: "offer_drafted" })
    .eq("id", candidate.id);

  await writeAuditLog(candidate.id, "offer_drafted", "Offer letter draft generated for admin review.");

  return offer;
}

export async function markOfferSent(offerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle<OfferRecord>();

  if (offerError || !offer) {
    throw new Error(offerError?.message ?? "Offer not found.");
  }

  if (offer.offer_status === "signed") {
    throw new Error("Signed offers cannot be resent.");
  }

  const { data: updatedOffer, error: updateError } = await supabase
    .from("offers")
    .update({
      offer_status: "sent",
      sent_at: new Date().toISOString()
    })
    .eq("id", offer.id)
    .select("*")
    .single<OfferRecord>();

  if (updateError) {
    throw new Error(`Failed to mark offer as sent: ${updateError.message}`);
  }

  await supabase
    .from("candidates")
    .update({ current_status: "offer_sent" })
    .eq("id", offer.candidate_id);

  await writeAuditLog(offer.candidate_id, "offer_sent", "Offer sent to candidate for signature.");

  return updatedOffer;
}

export async function updateOfferEmailDelivery(
  offerId: string,
  input: {
    status: "sent" | "failed" | "skipped";
    recipient: string;
    error: string | null;
  }
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("offers")
    .update({
      offer_email_status: input.status,
      offer_email_error: input.error,
      offer_email_recipient: input.recipient
    })
    .eq("id", offerId);

  if (error) {
    throw new Error(`Failed to update offer email status: ${error.message}`);
  }
}

export async function getOfferMinimumStartDate(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: transcript } = await supabase
    .from("interview_transcripts")
    .select("completed_at")
    .eq("candidate_id", candidateId)
    .maybeSingle<{ completed_at: string }>();

  return transcript ? nextCalendarDate(transcript.completed_at) : "";
}

export async function getOfferSigningView(signingToken: string): Promise<OfferSigningView | null> {
  const supabase = createSupabaseAdminClient();
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("*")
    .eq("signing_token", signingToken)
    .maybeSingle<OfferRecord>();

  if (offerError || !offer) {
    return null;
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", offer.candidate_id)
    .maybeSingle<CandidateRecord>();

  if (!candidate) {
    return null;
  }

  const { data: candidateRole } = await supabase
    .from("roles")
    .select("*")
    .eq("id", candidate.role_id)
    .maybeSingle<RoleRecord>();

  return {
    offer,
    candidate,
    role: candidateRole ?? null
  };
}

export async function signOffer(input: {
  signingToken: string;
  signatureImageData: string;
  signerIp: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: offer, error: offerError } = await supabase
    .from("offers")
    .select("*")
    .eq("signing_token", input.signingToken)
    .maybeSingle<OfferRecord>();

  if (offerError || !offer) {
    throw new Error(offerError?.message ?? "Offer link is invalid.");
  }

  if (offer.offer_status === "signed") {
    return { offer, alreadySigned: true };
  }

  if (!input.signatureImageData.startsWith("data:image/png;base64,")) {
    throw new Error("Please provide a drawn signature before submitting.");
  }

  if (input.signatureImageData.length > 1_000_000) {
    throw new Error("Signature image is too large. Please clear and sign again.");
  }

  const signedAt = new Date().toISOString();
  const { data: signedOffer, error: signError } = await supabase
    .from("offers")
    .update({
      offer_status: "signed",
      signed_at: signedAt,
      signer_ip: input.signerIp,
      signer_name: null,
      signature_image_data: input.signatureImageData
    })
    .eq("id", offer.id)
    .neq("offer_status", "signed")
    .select("*")
    .maybeSingle<OfferRecord>();

  if (signError) {
    throw new Error(`Failed to sign offer: ${signError.message}`);
  }

  if (!signedOffer) {
    return { offer, alreadySigned: true };
  }

  await supabase
    .from("candidates")
    .update({ current_status: "offer_signed" })
    .eq("id", signedOffer.candidate_id);

  await supabase.from("audit_logs").insert({
    candidate_id: signedOffer.candidate_id,
    action_type: "offer_signed",
    action_detail: "Candidate signed the offer letter in the portal.",
    actor: "candidate"
  });

  return { offer: signedOffer, alreadySigned: false };
}
