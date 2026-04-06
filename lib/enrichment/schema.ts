/**
 * Structured output for Phase 02C profile enrichment. This is deliberately
 * separate from screening so online research can evolve independently without
 * changing the resume-scoring contract.
 */
import { z } from "zod";

const nullableSummary = z.string().trim().min(1).max(2000).nullable();
const discrepancySeveritySchema = z.enum(["low", "medium", "high"]);
const discrepancyTypeSchema = z.enum([
  "experience_mismatch",
  "role_scope_mismatch",
  "missing_supporting_evidence",
  "timeline_inconsistency",
  "project_claim_unverified"
]);

// Structured discrepancy flags are easier to render and defend than plain
// strings because reviewers can quickly see the issue type, severity, and
// source context.
export const discrepancyFlagSchema = z.object({
  type: discrepancyTypeSchema,
  severity: discrepancySeveritySchema,
  description: z.string().trim().min(10).max(500),
  source: z.string().trim().min(1).max(100).nullable()
});

export const enrichmentModelOutputSchema = z.object({
  linkedin_summary: z.string().nullable(),
  github_summary: z.string().nullable(),
  portfolio_summary: z.string().nullable(),
  x_summary: z.string().nullable(),
  discrepancy_flags: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
      description: z.string(),
      source: z.string().nullable()
    })
  ),
  confidence_score: z.number(),
  candidate_brief: z.string()
});

export const enrichmentOutputSchema = z.object({
  linkedin_summary: nullableSummary,
  github_summary: nullableSummary,
  portfolio_summary: nullableSummary,
  x_summary: nullableSummary,
  discrepancy_flags: z.array(discrepancyFlagSchema).max(10),
  confidence_score: z.number().int().min(0).max(100),
  candidate_brief: z.string().trim().min(60).max(2000)
});

export type EnrichmentOutput = z.infer<typeof enrichmentOutputSchema>;
export type EnrichmentModelOutput = z.infer<typeof enrichmentModelOutputSchema>;
export type DiscrepancyFlag = z.infer<typeof discrepancyFlagSchema>;
