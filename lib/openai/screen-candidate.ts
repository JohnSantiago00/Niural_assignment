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
    "You are screening a candidate resume against a single job description.",
    "Use only the provided resume text and role information.",
    "Do not invent facts, employers, education, skills, or achievements that are not grounded in the resume text.",
    "Return structured output that reflects only what can be reasonably supported by the resume.",
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
            text: "You are an assistant that screens resumes against job descriptions and returns only well-grounded structured hiring output."
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

