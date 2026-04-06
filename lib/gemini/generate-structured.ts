/**
 * Shared Gemini structured-generation helper. We keep Gemini usage centralized
 * so screening and enrichment can share the same SDK wiring while preserving
 * separate prompts, schemas, and persistence layers.
 */
import { GoogleGenAI } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ZodType } from "zod";
import { getGeminiModel, getRequiredEnv } from "@/lib/utils/env";

function toGeminiJsonSchema(schema: ZodType) {
  return zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7"
  });
}

export async function generateStructuredObject<TData = unknown>({
  validationSchema,
  responseSchema,
  systemInstruction,
  prompt
}: {
  validationSchema?: ZodType;
  responseSchema?: ZodType;
  systemInstruction: string;
  prompt: string;
}): Promise<{ data: TData; modelName: string }> {
  const modelName = getGeminiModel();
  const ai = new GoogleGenAI({
    apiKey: getRequiredEnv("GEMINI_API_KEY")
  });
  const schemaForResponse = responseSchema ?? validationSchema;

  if (!schemaForResponse) {
    throw new Error("Gemini structured generation requires a response or validation schema.");
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiJsonSchema(schemaForResponse)
    }
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("Gemini did not return any structured output text.");
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini returned invalid JSON output.");
  }

  if (validationSchema) {
    const validated = validationSchema.safeParse(parsedJson);

    if (!validated.success) {
      throw new Error(`Gemini returned malformed structured output: ${validated.error.issues[0]?.message ?? "Unknown validation error"}`);
    }

    return {
      data: validated.data as TData,
      modelName
    };
  }

  return {
    data: parsedJson as TData,
    modelName
  };
}
