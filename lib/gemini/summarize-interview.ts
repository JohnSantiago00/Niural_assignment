/**
 * Gemini helper for Phase 04 interview notes. The transcript is generated or
 * supplied by the app; Gemini only turns that transcript into a bounded review
 * artifact that is validated before persistence.
 */
import { z } from "zod";
import { generateStructuredObject } from "@/lib/gemini/generate-structured";

export const interviewSummarySchema = z.object({
  overall_assessment: z.string().trim().min(1).max(1000),
  strengths_observed: z.array(z.string().trim().min(1).max(240)).min(1).max(8),
  concerns_observed: z.array(z.string().trim().min(1).max(240)).max(8),
  key_topics_discussed: z.array(z.string().trim().min(1).max(160)).min(1).max(10),
  recommended_follow_up: z.array(z.string().trim().min(1).max(240)).max(6),
  concise_summary: z.string().trim().min(1).max(800)
});

export type InterviewSummaryOutput = z.infer<typeof interviewSummarySchema>;

function sanitizeItems(items: string[], limit: number) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export async function summarizeInterviewTranscript(input: {
  candidateName: string;
  roleTitle: string;
  transcriptText: string;
}) {
  const { data, modelName } = await generateStructuredObject<InterviewSummaryOutput>({
    validationSchema: interviewSummarySchema,
    responseSchema: interviewSummarySchema,
    systemInstruction:
      "You summarize hiring interviews from provided transcript text only. Do not invent answers, outcomes, or interviewer conclusions that are not grounded in the transcript.",
    prompt: [
      "Create a structured interview summary for the internal hiring dashboard.",
      "Use only the transcript content below.",
      "Keep the output practical for a hiring manager reviewing the candidate after the interview.",
      "",
      `Candidate: ${input.candidateName}`,
      `Role: ${input.roleTitle}`,
      "",
      "Transcript:",
      input.transcriptText
    ].join("\n")
  });

  return {
    summary: interviewSummarySchema.parse({
      overall_assessment: data.overall_assessment.trim(),
      strengths_observed: sanitizeItems(data.strengths_observed, 8),
      concerns_observed: sanitizeItems(data.concerns_observed, 8),
      key_topics_discussed: sanitizeItems(data.key_topics_discussed, 10),
      recommended_follow_up: sanitizeItems(data.recommended_follow_up, 6),
      concise_summary: data.concise_summary.trim()
    }),
    modelName
  };
}
