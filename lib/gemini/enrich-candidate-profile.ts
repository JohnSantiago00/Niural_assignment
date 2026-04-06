/**
 * Gemini enrichment helper. Enrichment remains separate from screening so the
 * system can add external context for shortlisted candidates without changing
 * the resume-fit decision path.
 */
import { generateStructuredObject } from "@/lib/gemini/generate-structured";
import {
  type DiscrepancyFlag,
  type EnrichmentModelOutput,
  enrichmentModelOutputSchema,
  enrichmentOutputSchema,
  type EnrichmentOutput
} from "@/lib/enrichment/schema";
import type { RoleRecord, ScreeningResultRecord } from "@/types/database";
import type { EnrichmentSourceContent } from "@/lib/enrichment/source-fetch";

type EnrichCandidateProfileParams = {
  role: RoleRecord;
  screeningResult: ScreeningResultRecord | null;
  sources: EnrichmentSourceContent[];
};

function formatSource(source: EnrichmentSourceContent) {
  return [
    `Source: ${source.kind}`,
    `URL: ${source.url ?? "not provided"}`,
    `Status: ${source.status}`,
    `Title: ${source.title ?? "not available"}`,
    `Description: ${source.description ?? "not available"}`,
    `Note: ${source.note ?? "none"}`,
    `Content: ${source.content ?? "not available"}`
  ].join("\n");
}

function buildEnrichmentPrompt({
  role,
  screeningResult,
  sources
}: EnrichCandidateProfileParams) {
  return [
    "Generate a candidate enrichment profile for an internal hiring dashboard.",
    "Use only the provided screening context and fetched source content.",
    "Do not invent online facts, projects, employers, or discrepancies.",
    "Treat blocked, missing, sparse, or unavailable sources as limitations, not evidence.",
    "The candidate_brief is the primary recruiter artifact and should be the clearest, highest-value output.",
    "The candidate_brief must be 3 to 5 sentences and readable by a hiring manager in under 60 seconds.",
    "confidence_score should represent enrichment quality, not candidate quality. It should reflect source availability, source consistency, amount of usable content, and evidence quality.",
    "Discrepancy flags must be conservative. Missing data alone is not a discrepancy. Only flag a discrepancy when the available evidence suggests a real mismatch, contradiction, or unsupported claim.",
    "",
    "Role context:",
    `Title: ${role.title}`,
    `Team: ${role.team}`,
    `Responsibilities: ${role.responsibilities.join("; ")}`,
    `Requirements: ${role.requirements.join("; ")}`,
    "",
    "Screening context:",
    screeningResult
      ? `Fit score: ${screeningResult.fit_score}
Shortlist recommendation: ${screeningResult.shortlist_recommendation ? "true" : "false"}
Rationale: ${screeningResult.rationale}
Strengths: ${screeningResult.strengths.join("; ")}
Gaps: ${screeningResult.gaps.join("; ")}`
      : "No screening result available.",
    "",
    "Discrepancy flag guidance:",
    "- type should be one of: experience_mismatch, role_scope_mismatch, missing_supporting_evidence, timeline_inconsistency, project_claim_unverified",
    "- severity should be low, medium, or high",
    "- source should name the source that triggered the concern when possible",
    "- use an empty array if there are no meaningful grounded discrepancies",
    "- keep the discrepancy list concise and do not exceed 10 items",
    "",
    "Fetched source content:",
    ...sources.map(formatSource)
  ].join("\n\n");
}

function sanitizeDiscrepancyFlags(
  items: Array<{ type: string; severity: string; description: string; source: string | null }>
): DiscrepancyFlag[] {
  const allowedTypes = new Set([
    "experience_mismatch",
    "role_scope_mismatch",
    "missing_supporting_evidence",
    "timeline_inconsistency",
    "project_claim_unverified"
  ]);
  const allowedSeverities = new Set(["low", "medium", "high"]);

  return items
    .slice(0, 10)
    .map((item) => ({
      type: allowedTypes.has(item.type)
        ? (item.type as DiscrepancyFlag["type"])
        : "missing_supporting_evidence",
      severity: allowedSeverities.has(item.severity)
        ? (item.severity as DiscrepancyFlag["severity"])
        : "low",
      description: item.description.trim().slice(0, 500),
      source: item.source?.trim().slice(0, 100) ?? null
    }))
    .filter((item) => item.description.length > 0);
}

function sanitizeEnrichmentOutput(data: {
  linkedin_summary: string | null;
  github_summary: string | null;
  portfolio_summary: string | null;
  x_summary: string | null;
  discrepancy_flags: Array<{ type: string; severity: string; description: string; source: string | null }>;
  confidence_score: number;
  candidate_brief: string;
}): EnrichmentOutput {
  const trimSummary = (value: string | null) => value?.trim().slice(0, 2000) ?? null;

  return enrichmentOutputSchema.parse({
    linkedin_summary: trimSummary(data.linkedin_summary),
    github_summary: trimSummary(data.github_summary),
    portfolio_summary: trimSummary(data.portfolio_summary),
    x_summary: trimSummary(data.x_summary),
    discrepancy_flags: sanitizeDiscrepancyFlags(data.discrepancy_flags),
    confidence_score: Math.max(0, Math.min(100, Math.round(data.confidence_score))),
    candidate_brief: data.candidate_brief.trim()
  });
}

export async function enrichCandidateProfile({
  role,
  screeningResult,
  sources
}: EnrichCandidateProfileParams): Promise<{
  enrichment: EnrichmentOutput;
  modelName: string;
}> {
  const { data, modelName } = await generateStructuredObject<EnrichmentModelOutput>({
    validationSchema: enrichmentModelOutputSchema,
    responseSchema: enrichmentModelOutputSchema,
    systemInstruction:
      "You create conservative hiring enrichment summaries from provided source content. Treat the output as supplemental context, not final truth.",
    prompt: buildEnrichmentPrompt({ role, screeningResult, sources })
  });

  return {
    enrichment: sanitizeEnrichmentOutput(data),
    modelName
  };
}
