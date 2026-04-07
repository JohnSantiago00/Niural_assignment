/**
 * Phase 06 helper: Gemini writes the welcome-message copy only. The app still
 * decides whether the candidate has joined Slack and when messages are sent.
 */
import { z } from "zod";
import { generateStructuredObject } from "@/lib/gemini/generate-structured";

export const slackWelcomeSchema = z.object({
  welcome_message: z.string().trim().min(80).max(1200)
});

export type SlackWelcomeOutput = z.infer<typeof slackWelcomeSchema>;

export async function generateSlackWelcomeMessage(input: {
  candidateName: string;
  roleTitle: string;
  startDate: string;
  managerName: string;
  resourceLinks: string[];
}) {
  const { data, modelName } = await generateStructuredObject<SlackWelcomeOutput>({
    validationSchema: slackWelcomeSchema,
    responseSchema: slackWelcomeSchema,
    systemInstruction:
      "Write concise, warm Slack onboarding welcome messages from provided hiring data only. Do not invent policies, benefits, channels, or links. Return only the message in welcome_message.",
    prompt: [
      "Create a friendly Slack welcome message for a new hire.",
      "Include their name, role, start date, a greeting from their manager, and the provided onboarding resource links.",
      "Keep it short, polished, and suitable for a Slack DM or onboarding channel.",
      "",
      `Name: ${input.candidateName}`,
      `Role: ${input.roleTitle}`,
      `Start date: ${input.startDate}`,
      `Manager: ${input.managerName}`,
      `Resource links: ${input.resourceLinks.length > 0 ? input.resourceLinks.join(", ") : "None provided"}`
    ].join("\n")
  });

  return {
    message: data.welcome_message.trim(),
    modelName
  };
}
