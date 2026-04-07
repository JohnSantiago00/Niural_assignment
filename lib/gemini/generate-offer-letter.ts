/**
 * Gemini helper for Phase 05 offer drafting. Gemini writes only the offer
 * letter text from explicit admin inputs and candidate context; app code owns
 * status transitions, sending, and signature validation.
 */
import { z } from "zod";
import { generateStructuredObject } from "@/lib/gemini/generate-structured";

export const offerLetterSchema = z.object({
  offer_letter: z.string().trim().min(500).max(7000)
});

export type OfferLetterOutput = z.infer<typeof offerLetterSchema>;

export async function generateOfferLetterDraft(input: {
  candidateName: string;
  roleTitle: string;
  team: string;
  screeningSummary: string | null;
  interviewSummary: string | null;
  confirmedJobTitle: string;
  startDate: string;
  baseSalary: string;
  equityOrBonus: string | null;
  reportingManager: string;
  customTerms: string | null;
}) {
  const { data, modelName } = await generateStructuredObject<OfferLetterOutput>({
    validationSchema: offerLetterSchema,
    responseSchema: offerLetterSchema,
    systemInstruction:
      "You draft professional employment offer letters from provided hiring inputs only. Return only a plain English letter in the offer_letter string. Do not include JSON, markdown code fences, placeholders, signature-line field names, legal terms, benefits, equity, immigration terms, or policies that are not provided. Keep the tone businesslike and ready for candidate review.",
    prompt: [
      "Draft a complete professional offer letter for this candidate.",
      "Use only the information below. If a term is not provided, do not add it.",
      "Write normal letter prose only. Do not output JSON. Do not include labels like candidate_signature_line or company_signature_line.",
      "Include a short opening, role and reporting details, base salary, start date, acceptance language, and a warm close from Niural Hiring Team.",
      "",
      `Candidate: ${input.candidateName}`,
      `Original role: ${input.roleTitle}`,
      `Team: ${input.team}`,
      `Confirmed job title: ${input.confirmedJobTitle}`,
      `Start date: ${input.startDate}`,
      `Base salary: ${input.baseSalary}`,
      `Equity or bonus: ${input.equityOrBonus ?? "Not provided"}`,
      `Reporting manager: ${input.reportingManager}`,
      `Custom terms or notes: ${input.customTerms ?? "None"}`,
      "",
      `Screening context: ${input.screeningSummary ?? "Not available"}`,
      `Interview context: ${input.interviewSummary ?? "Not available"}`
    ].join("\n")
  });

  const letter = sanitizeOfferLetter(data.offer_letter);

  return {
    letter,
    modelName
  };
}

function sanitizeOfferLetter(value: string) {
  let text = value.trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { offer_letter?: unknown; letter?: unknown };
      const extracted = parsed.offer_letter ?? parsed.letter;

      if (typeof extracted === "string") {
        text = extracted.trim();
      }
    } catch {
      // If parsing fails, continue with line-level cleanup rather than hiding the draft.
    }
  }

  return text
    .split("\n")
    .filter((line) => {
      const normalized = line.toLowerCase();
      return (
        !normalized.includes("candidate_signature_line") &&
        !normalized.includes("company_signature_line") &&
        !normalized.includes('"date"') &&
        !normalized.includes('"recipient"')
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
