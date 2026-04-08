/**
 * Supabase Storage helpers for the private resume bucket. Resume uploads stay
 * server-side so the browser never needs privileged storage access.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRequiredEnv } from "@/lib/utils/env";
import { sanitizeFileName } from "@/lib/utils/resume";
import type { ApplicationSubmissionValues } from "@/types/application";

/**
 * Uploads a validated resume into the configured private storage bucket and
 * returns the stored path that gets saved on the application record.
 */
export async function uploadResumeFile(values: ApplicationSubmissionValues) {
  const supabase = createSupabaseAdminClient();
  const bucket = getRequiredEnv("SUPABASE_RESUME_BUCKET");
  const fileName = sanitizeFileName(values.resume.name);
  const path = `${values.role_id}/${values.email.toLowerCase()}/${Date.now()}-${fileName}`;

  const arrayBuffer = await values.resume.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    cacheControl: "3600",
    contentType: values.resume.type || undefined,
    upsert: false
  });

  if (error) {
    throw new Error(`Failed to upload resume: ${error.message}`);
  }

  return path;
}

/**
 * Best-effort cleanup used when a later submission step fails after upload.
 */
export async function deleteResumeFile(path: string) {
  const supabase = createSupabaseAdminClient();
  const bucket = getRequiredEnv("SUPABASE_RESUME_BUCKET");
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Failed to delete resume: ${error.message}`);
  }
}

/**
 * Downloads the raw resume file for screening.
 */
export async function downloadResumeFile(path: string) {
  const supabase = createSupabaseAdminClient();
  const bucket = getRequiredEnv("SUPABASE_RESUME_BUCKET");
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error || !data) {
    throw new Error(`Failed to download resume: ${error?.message ?? "Unknown storage error"}`);
  }

  return data;
}
