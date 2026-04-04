/**
 * Structured AI screening schema. The model must return exactly this shape so
 * the application can validate it before updating any candidate records.
 */
import { z } from "zod";

export const screeningOutputSchema = z.object({
  extracted_skills: z.array(z.string().trim()).max(30),
  years_experience: z.number().min(0).max(60).nullable(),
  education: z.array(z.string().trim()).max(20),
  past_employers: z.array(z.string().trim()).max(30),
  key_achievements: z.array(z.string().trim()).max(20),
  strengths: z.array(z.string().trim()).min(1).max(10),
  gaps: z.array(z.string().trim()).min(1).max(10),
  fit_score: z.number().int().min(0).max(100),
  rationale: z.string().trim().min(20).max(4000),
  shortlist_recommendation: z.boolean()
});

export type ScreeningOutput = z.infer<typeof screeningOutputSchema>;

export const shortlistOverrideSchema = z.object({
  decision: z.enum(["shortlist", "do_not_shortlist"]),
  note: z.string().trim().min(5, "Override note must be at least 5 characters.").max(1000)
});

