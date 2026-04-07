/**
 * Gemini is used here only to summarize a candidate's free-form reschedule
 * note into scheduling hints. The model never selects actual slots; the real
 * replacement options still come from Google free/busy plus DB-backed hold
 * conflict filtering.
 */
import { z } from "zod";
import { generateStructuredObject } from "@/lib/gemini/generate-structured";
import type { ReschedulePreferences } from "@/types/database";

const reschedulePreferencesSchema = z.object({
  preferred_time_of_day: z.enum(["morning", "afternoon", "evening"]).nullable(),
  preferred_days: z.array(z.string().trim().min(1).max(40)).max(5),
  avoid_days: z.array(z.string().trim().min(1).max(40)).max(5),
  avoid_time_ranges: z.array(z.string().trim().min(1).max(80)).max(5),
  earliest_date: z.string().trim().min(1).max(20).nullable(),
  notes_summary: z.string().trim().min(1).max(240)
});

export async function interpretReschedulePreferences(
  note: string
): Promise<ReschedulePreferences | null> {
  try {
    const { data } = await generateStructuredObject<ReschedulePreferences>({
      validationSchema: reschedulePreferencesSchema,
      responseSchema: reschedulePreferencesSchema,
      systemInstruction:
        "You extract only grounded scheduling preferences from a candidate reschedule note. Do not invent dates, times, or constraints that are not supported by the note.",
      prompt: [
        "Interpret this candidate reschedule note into scheduling hints only.",
        "Do not propose final interview slots.",
        "Use null or empty arrays when the note does not clearly specify a preference.",
        "preferred_days and avoid_days should contain concise weekday-style strings when grounded in the note.",
        "avoid_time_ranges should contain concise human-readable ranges only when explicitly suggested by the note.",
        "earliest_date should be returned only if the note implies or states a specific earliest date.",
        "",
        `Candidate note: ${note}`
      ].join("\n")
    });

    return {
      ...data,
      preferred_days: data.preferred_days.map((item) => item.trim()),
      avoid_days: data.avoid_days.map((item) => item.trim()),
      avoid_time_ranges: data.avoid_time_ranges.map((item) => item.trim()),
      notes_summary: data.notes_summary.trim()
    };
  } catch (error) {
    // Scheduling should keep moving even if the AI note interpreter is noisy or
    // unavailable. Admin can still act on the original note directly.
    console.error("Failed to interpret reschedule preferences", error);
    return null;
  }
}
