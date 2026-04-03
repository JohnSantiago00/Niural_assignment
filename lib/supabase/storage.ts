import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getRequiredEnv } from "@/lib/utils/env";
import { sanitizeFileName } from "@/lib/utils/resume";
import type { ApplicationSubmissionValues } from "@/types/application";

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

export async function deleteResumeFile(path: string) {
  const supabase = createSupabaseAdminClient();
  const bucket = getRequiredEnv("SUPABASE_RESUME_BUCKET");
  await supabase.storage.from(bucket).remove([path]);
}
