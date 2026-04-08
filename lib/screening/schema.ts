/**
 * Structured AI screening schema. The model must return exactly this shape so
 * the application can validate it before updating any candidate records.
 */
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .nullable();

// Education and employer history are stored as structured objects so the admin
// UI can render resume evidence without reparsing free-form strings.
export const educationEntrySchema = z.object({
  institution: z.string().trim().min(1).max(200),
  degree: optionalText,
  field: optionalText,
  year: z.number().int().min(1900).max(2100).nullable()
});

export const pastEmployerEntrySchema = z.object({
  company: z.string().trim().min(1).max(200),
  title: optionalText,
  duration: optionalText
});

// Gemini gets a simplified schema with fewer constraints so structured output
// remains serveable, while the richer schema below still validates before DB
// writes. This keeps the model contract practical without weakening app safety.
export const screeningModelOutputSchema = z.object({
  extracted_skills: z.array(z.string()),
  years_experience: z.number().nullable(),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      year: z.number().nullable()
    })
  ),
  past_employers: z.array(
    z.object({
      company: z.string(),
      title: z.string().nullable(),
      duration: z.string().nullable()
    })
  ),
  key_achievements: z.array(z.string()),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  fit_score: z.number(),
  rationale: z.string(),
  shortlist_recommendation: z.boolean()
});

export const screeningOutputSchema = z.object({
  extracted_skills: z.array(z.string().trim()).max(30),
  years_experience: z.number().min(0).max(60).nullable(),
  education: z.array(educationEntrySchema).max(20),
  past_employers: z.array(pastEmployerEntrySchema).max(30),
  key_achievements: z.array(z.string().trim()).max(20),
  // Keeping at least one strength and one gap makes the output more useful for
  // hiring review. A screening result without both sides tends to read like a
  // vague summary instead of a decision-support artifact.
  strengths: z.array(z.string().trim()).min(1).max(10),
  gaps: z.array(z.string().trim()).min(1).max(10),
  fit_score: z.number().int().min(0).max(100),
  rationale: z.string().trim().min(20).max(4000),
  shortlist_recommendation: z.boolean()
});

export type ScreeningOutput = z.infer<typeof screeningOutputSchema>;
export type ScreeningModelOutput = z.infer<typeof screeningModelOutputSchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type PastEmployerEntry = z.infer<typeof pastEmployerEntrySchema>;

export const shortlistOverrideSchema = z.object({
  decision: z.enum(["shortlist", "do_not_shortlist"]),
  note: z.string().trim().min(5, "Override note must be at least 5 characters.").max(1000)
});
