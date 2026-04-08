/**
 * Coordinates application submission from validated form input to durable
 * records in Supabase: role check -> duplicate check -> resume upload ->
 * application -> candidate -> audit log -> confirmation email.
 */
import { sendApplicationConfirmationEmail } from "@/lib/email/send-application-confirmation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { deleteResumeFile, uploadResumeFile } from "@/lib/supabase/storage";
import { ApiError } from "@/lib/utils/api";
import type { ApplicationSubmissionValues } from "@/types/application";

type SubmissionResult = {
  applicationId: string;
  candidateId: string;
  emailStatus: "sent" | "failed" | "skipped";
  emailError?: string;
};

/**
 * Accepts already-validated submission values from the API route and executes
 * the deterministic intake workflow in one place so duplicate checks, storage,
 * relational writes, rollback, and email side effects stay easy to reason about.
 */
export async function submitApplication(
  input: ApplicationSubmissionValues
): Promise<SubmissionResult> {
  // Normalize candidate identity fields before using them for duplicate checks
  // and storage paths. Lowercasing the email is important because the DB unique
  // constraint should behave consistently regardless of input casing.
  const values = {
    ...input,
    email: input.email.trim().toLowerCase(),
    full_name: input.full_name.trim(),
    linkedin_url: input.linkedin_url.trim(),
    portfolio_url: input.portfolio_url?.trim(),
    github_url: input.github_url?.trim()
  };

  const supabase = createSupabaseAdminClient();

  // Re-check the role at submit time so a stale form cannot apply to a role
  // that was closed or removed after the page was loaded.
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, title, status")
    .eq("id", values.role_id)
    .maybeSingle();

  if (roleError) {
    throw new Error(`Failed to fetch role: ${roleError.message}`);
  }

  if (!role) {
    throw new ApiError(404, "The selected role could not be found.", "role_not_found");
  }

  if (role.status !== "open") {
    throw new ApiError(
      409,
      "This role is no longer accepting applications.",
      "role_closed"
    );
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from("applications")
    .select("id")
    .eq("role_id", values.role_id)
    .eq("email", values.email)
    .maybeSingle();

  if (duplicateError) {
    throw new Error(`Failed to check for duplicate applications: ${duplicateError.message}`);
  }

  if (duplicate) {
    throw new ApiError(
      409,
      "An application already exists for this email and role.",
      "duplicate_application"
    );
  }

  let resumeFilePath: string | null = null;
  let applicationId: string | null = null;

  try {
    resumeFilePath = await uploadResumeFile(values);

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .insert({
        role_id: values.role_id,
        full_name: values.full_name,
        email: values.email,
        linkedin_url: values.linkedin_url,
        portfolio_url: values.portfolio_url ?? null,
        github_url: values.github_url ?? null,
        resume_file_path: resumeFilePath,
        submission_status: "submitted"
      })
      .select("id")
      .single();

    if (applicationError) {
      if (applicationError.code === "23505") {
        throw new ApiError(
          409,
          "An application already exists for this email and role.",
          "duplicate_application"
        );
      }

      throw new Error(`Failed to create application: ${applicationError.message}`);
    }

    applicationId = application.id;

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        application_id: application.id,
        role_id: values.role_id,
        full_name: values.full_name,
        email: values.email,
        linkedin_url: values.linkedin_url,
        portfolio_url: values.portfolio_url ?? null,
        github_url: values.github_url ?? null,
        current_status: "applied"
      })
      .select("id")
      .single();

    if (candidateError) {
      throw new Error(`Failed to create candidate: ${candidateError.message}`);
    }

    const { error: auditLogError } = await supabase.from("audit_logs").insert({
      candidate_id: candidate.id,
      action_type: "application_created",
      action_detail: `Application submitted for ${role.title}.`,
      actor: "system"
    });

    if (auditLogError) {
      console.error("Failed to insert audit log", auditLogError);
    }

    const emailResult = await sendApplicationConfirmationEmail({
      candidateName: values.full_name,
      roleTitle: role.title,
      email: values.email
    });

    return {
      applicationId: application.id,
      candidateId: candidate.id,
      emailStatus: emailResult.status,
      emailError: emailResult.error
    };
  } catch (error) {
    // Keep rollback logic readable in application code instead of hiding it in
    // a database function. If candidate creation fails, deleting the
    // application row also removes dependent candidate/audit rows via cascades.
    if (applicationId) {
      const { error: rollbackError } = await supabase
        .from("applications")
        .delete()
        .eq("id", applicationId);

      if (rollbackError) {
        console.error("Failed to roll back application after submission error", rollbackError);
      }
    }

    if (resumeFilePath) {
      try {
        await deleteResumeFile(resumeFilePath);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded resume after submission error", cleanupError);
      }
    }

    throw error;
  }
}
