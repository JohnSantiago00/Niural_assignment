/**
 * Gemini screening helper. Gemini is used only to produce grounded structured
 * screening output; deterministic candidate state changes still happen in
 * application logic after the result passes Zod validation.
 */
import { generateStructuredObject } from "@/lib/gemini/generate-structured";
import {
  type ScreeningModelOutput,
  type EducationEntry,
  type PastEmployerEntry,
  screeningModelOutputSchema,
  screeningOutputSchema,
  type ScreeningOutput
} from "@/lib/screening/schema";
import type { RoleRecord } from "@/types/database";

type ScreenCandidateWithAiParams = {
  role: RoleRecord;
  resumeText: string;
};

function buildScreeningPrompt(role: RoleRecord, resumeText: string) {
  return [
    "Screen this resume against one job description.",
    "Use only the provided resume text and role information.",
    "Do not invent facts, employers, education, skills, timelines, or achievements that are not grounded in the resume text.",
    "Return structured output only.",
    "",
    "Scoring guidance:",
    "- Weight explicit requirements more heavily than nice-to-have responsibilities.",
    "- Use responsibilities to assess practical relevance, but do not let them outweigh core requirements.",
    "- Missing evidence should reduce confidence and score moderately, not automatically force an extremely low score.",
    "- Give low scores only when the resume is clearly misaligned with the role.",
    "- Do not give inflated scores when evidence is weak, indirect, or ambiguous.",
    "- Fit score ranges should roughly mean:",
    "  - 85-100: strong match with clear evidence for most core requirements and relevant achievements",
    "  - 70-84: solid or plausible match with some gaps, but enough evidence to seriously consider",
    "  - 50-69: partial fit with relevant overlap but notable missing evidence or weaker alignment",
    "  - 25-49: limited alignment or weak match",
    "  - 0-24: clearly poor fit for this role",
    "- Shortlist recommendation should generally be true only when the candidate looks interview-worthy based on the resume alone.",
    "- The rationale should be concise and practical for a recruiter or hiring manager.",
    "",
    "Role details:",
    `Title: ${role.title}`,
    `Team: ${role.team}`,
    `Location: ${role.location}`,
    `Remote status: ${role.remote_status}`,
    `Experience level: ${role.experience_level}`,
    `Responsibilities: ${role.responsibilities.join("; ")}`,
    `Requirements: ${role.requirements.join("; ")}`,
    "",
    "Extraction rules:",
    "- education: return one object per education entry found in the resume",
    "- past_employers: return one object per company or role history item found in the resume",
    "- For missing fields inside an education or employer object, use null instead of guessing",
    "- strengths and gaps should each contain concise recruiter-friendly bullets grounded in the resume",
    "- Keep arrays concise. Do not exceed 30 skills, 20 education items, 30 past employers, 20 achievements, or 10 strengths/gaps.",
    "",
    "Resume text:",
    resumeText
  ].join("\n");
}

function trimNullableText(value: string | null) {
  return value?.trim().slice(0, 200) ?? null;
}

function sanitizeEducation(items: Array<{
  institution: string;
  degree: string | null;
  field: string | null;
  year: number | null;
}>): EducationEntry[] {
  return items.slice(0, 20).map((item) => ({
    institution: item.institution.trim().slice(0, 200),
    degree: trimNullableText(item.degree),
    field: trimNullableText(item.field),
    year: item.year === null ? null : Math.max(1900, Math.min(2100, Math.round(item.year)))
  }));
}

function sanitizeEmployers(items: Array<{
  company: string;
  title: string | null;
  duration: string | null;
}>): PastEmployerEntry[] {
  return items.slice(0, 30).map((item) => ({
    company: item.company.trim().slice(0, 200),
    title: trimNullableText(item.title),
    duration: trimNullableText(item.duration)
  }));
}

function sanitizeScreeningOutput(data: {
  extracted_skills: string[];
  years_experience: number | null;
  education: Array<{ institution: string; degree: string | null; field: string | null; year: number | null }>;
  past_employers: Array<{ company: string; title: string | null; duration: string | null }>;
  key_achievements: string[];
  strengths: string[];
  gaps: string[];
  fit_score: number;
  rationale: string;
  shortlist_recommendation: boolean;
}): ScreeningOutput {
  return screeningOutputSchema.parse({
    extracted_skills: data.extracted_skills
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30),
    years_experience:
      data.years_experience === null
        ? null
        : Math.max(0, Math.min(60, Number(data.years_experience))),
    education: sanitizeEducation(data.education),
    past_employers: sanitizeEmployers(data.past_employers),
    key_achievements: data.key_achievements
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20),
    strengths: data.strengths
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10),
    gaps: data.gaps
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10),
    fit_score: Math.max(0, Math.min(100, Math.round(data.fit_score))),
    rationale: data.rationale.trim(),
    shortlist_recommendation: data.shortlist_recommendation
  });
}

export async function screenCandidateWithAi({
  role,
  resumeText
}: ScreenCandidateWithAiParams): Promise<{
  screening: ScreeningOutput;
  modelName: string;
}> {
  const { data, modelName } = await generateStructuredObject<ScreeningModelOutput>({
    validationSchema: screeningModelOutputSchema,
    responseSchema: screeningModelOutputSchema,
    systemInstruction:
      "You screen resumes against job descriptions and return only well-grounded structured hiring output. Treat the result as decision support, not final truth.",
    prompt: buildScreeningPrompt(role, resumeText)
  });

  return {
    screening: sanitizeScreeningOutput(data),
    modelName
  };
}
