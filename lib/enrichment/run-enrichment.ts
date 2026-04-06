/**
 * End-to-end Phase 02C enrichment workflow. Eligibility is enforced here in
 * deterministic application logic so only shortlisted candidates can be
 * enriched, regardless of what the UI shows.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { fetchEnrichmentSources } from "@/lib/enrichment/source-fetch";
import { enrichCandidateProfile } from "@/lib/gemini/enrich-candidate-profile";
import type { ApplicationRecord, CandidateRecord, RoleRecord, ScreeningResultRecord } from "@/types/database";

type EnrichmentContext = {
  candidate: CandidateRecord;
  role: RoleRecord;
  screeningResult: ScreeningResultRecord | null;
};

export function isCandidateEligibleForEnrichment(candidate: Pick<CandidateRecord, "current_status">) {
  return candidate.current_status === "shortlisted";
}

async function getEnrichmentContext(candidateId: string): Promise<EnrichmentContext> {
  const supabase = createSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle<CandidateRecord>();

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for enrichment: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (!isCandidateEligibleForEnrichment(candidate)) {
    throw new Error("Only shortlisted candidates can be enriched.");
  }

  const [{ data: role, error: roleError }, { data: screeningResult, error: screeningError }] =
    await Promise.all([
      supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>(),
      supabase
        .from("screening_results")
        .select("*")
        .eq("candidate_id", candidate.id)
        .maybeSingle<ScreeningResultRecord>()
    ]);

  if (roleError || !role) {
    throw new Error(`Failed to load role for enrichment: ${roleError?.message ?? "Role not found"}`);
  }

  if (screeningError) {
    throw new Error(`Failed to load screening context for enrichment: ${screeningError.message}`);
  }

  return {
    candidate,
    role,
    screeningResult: screeningResult ?? null
  };
}

async function getCandidateLinks(applicationId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: application, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle<ApplicationRecord>();

  if (error || !application) {
    throw new Error(`Failed to load application links for enrichment: ${error?.message ?? "Application not found"}`);
  }

  return {
    linkedinUrl: application.linkedin_url,
    githubUrl: application.github_url,
    portfolioUrl: application.portfolio_url,
    xUrl: null as string | null
  };
}

export async function runCandidateEnrichment(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const context = await getEnrichmentContext(candidateId);
  const links = await getCandidateLinks(context.candidate.application_id);
  const sources = await fetchEnrichmentSources({
    ...links,
    candidateName: context.candidate.full_name
  });
  const { enrichment, modelName } = await enrichCandidateProfile({
    role: context.role,
    screeningResult: context.screeningResult,
    sources: [sources.linkedin, sources.github, sources.portfolio, sources.x]
  });

  const { error: profileError } = await supabase.from("research_profiles").upsert(
    {
      candidate_id: context.candidate.id,
      linkedin_url_used: sources.linkedin.url,
      linkedin_source_status: sources.linkedin.status,
      linkedin_source_note: sources.linkedin.note,
      github_url_used: sources.github.url,
      portfolio_url_used: sources.portfolio.url,
      x_url_used: sources.x.url,
      linkedin_summary:
        sources.linkedin.status === "missing"
          ? "LinkedIn profile was not provided."
          : enrichment.linkedin_summary ??
            sources.linkedin.note ??
            "Automated LinkedIn enrichment could not gather enough public evidence. The submitted LinkedIn URL is still available for manual review.",
      github_summary:
        sources.github.status === "missing" ? "GitHub profile was not provided." : enrichment.github_summary,
      portfolio_summary:
        sources.portfolio.status === "missing" ? "Portfolio URL was not provided." : enrichment.portfolio_summary,
      x_summary:
        sources.x.status === "missing" ? "X/Twitter enrichment was not run in this MVP." : enrichment.x_summary,
      discrepancy_flags: enrichment.discrepancy_flags,
      confidence_score: enrichment.confidence_score,
      candidate_brief: enrichment.candidate_brief,
      model_name: modelName
    },
    {
      onConflict: "candidate_id"
    }
  );

  if (profileError) {
    throw new Error(`Failed to save research profile: ${profileError.message}`);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    candidate_id: context.candidate.id,
    action_type: "profile_enrichment_completed",
    action_detail: "Profile enrichment completed for a shortlisted candidate using submitted links and fetched source content.",
    actor: "system"
  });

  if (auditError) {
    console.error("Failed to insert enrichment audit log", auditError);
  }

  return {
    candidateBrief: enrichment.candidate_brief
  };
}
