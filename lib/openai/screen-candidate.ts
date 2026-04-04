/**
 * OpenAI screening helper. AI is used only for extracting and evaluating the
 * candidate resume against the selected job description; deterministic status
 * updates still happen in application code after the response is validated.
 */
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAiScreeningModel, getRequiredEnv } from "@/lib/utils/env";
import { screeningOutputSchema, type ScreeningOutput } from "@/lib/screening/schema";
import type { RoleRecord } from "@/types/database";

type ScreenCandidateWithAiParams = {
  role: RoleRecord;
  resumeText: string;
};

function buildScreeningPrompt(role: RoleRecord, resumeText: string) {
  return [
    "You are screening one candidate resume against one job description.",
    "Use only the provided resume text and role information.",
    "Do not invent facts, employers, education, skills, timelines, or achievements that are not grounded in the resume text.",
    "Return structured output that reflects only what can be reasonably supported by the resume.",
    "",
    "Scoring guidance:",
    "- Weight explicit requirements more heavily than nice-to-have responsibilities.",
    "- Use responsibilities to assess relevance and likely day-to-day fit, but do not let them outweigh core requirements.",
    "- Missing evidence should reduce confidence and score moderately, not automatically force an extremely low score.",
    "- Give low scores only when the resume is clearly misaligned with the role.",
    "- Do not give inflated scores when the evidence is weak, indirect, or ambiguous.",
    "- Fit score ranges should roughly mean:",
    "  - 85-100: strong match with clear evidence for most core requirements and relevant achievements",
    "  - 70-84: solid or plausible match with some gaps, but enough evidence to seriously consider",
    "  - 50-69: partial fit with relevant overlap but notable missing evidence or weaker alignment",
    "  - 25-49: limited alignment or only a weak match",
    "  - 0-24: clearly poor fit for this role",
    "- Shortlist recommendation should generally be true only when the candidate looks interview-worthy based on the resume alone.",
    "- The rationale should be written for a recruiter or hiring manager in clear, practical language.",
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
    "",
    "Resume text:",
    resumeText
  ].join("\n");
}

/**
 * Calls the Responses API with a strict structured output schema so the
 * downstream workflow can trust the shape before persisting results.
 */
export async function screenCandidateWithAi({
  role,
  resumeText
}: ScreenCandidateWithAiParams): Promise<{
  screening: ScreeningOutput;
  modelName: string;
}> {
  const modelName = getOpenAiScreeningModel();
  const client = new OpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY")
  });

  const response = await client.responses.parse({
    model: modelName,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You are an assistant that screens resumes against job descriptions and returns only well-grounded structured hiring output. Treat the result as decision support, not final truth."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildScreeningPrompt(role, resumeText)
          }
        ]
      }
    ],
    text: {
      format: zodTextFormat(screeningOutputSchema, "screening_result")
    }
  });

  const screening = response.output_parsed;

  if (!screening) {
    throw new Error("The screening model did not return structured output.");
  }

  return {
    screening,
    modelName
  };
}
