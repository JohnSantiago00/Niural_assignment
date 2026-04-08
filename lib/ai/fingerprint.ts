/**
 * Small deterministic cache-key helper for Gemini-backed flows. Candidate ids
 * alone are not enough because the same candidate can be reprocessed after a
 * resume, transcript, role, prompt, model, or offer-input change.
 */
import crypto from "node:crypto";

type FingerprintInput = Record<string, unknown>;

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeValue(nestedValue)])
    );
  }

  if (typeof value === "string") {
    return value.trim().replace(/\s+/g, " ");
  }

  return value;
}

export function createInputFingerprint(input: FingerprintInput) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalizeValue(input)))
    .digest("hex");
}
