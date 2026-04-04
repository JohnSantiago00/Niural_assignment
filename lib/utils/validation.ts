/**
 * Shared Phase A validation rules. The client schema keeps the form responsive,
 * while the server schema remains the source of truth for any actual write to
 * Supabase.
 */
import { ZodError, z } from "zod";
import { MAX_RESUME_SIZE_BYTES, isSupportedResumeFile } from "@/lib/utils/resume";

// Optional URLs come from text inputs, so empty strings should behave like
// "not provided" instead of failing URL validation.
const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => !value || z.string().url().safeParse(value).success, {
    message: "Enter a valid URL."
  });

/**
 * Validation for the multipart payload received by the API route.
 */
export const applicationPayloadSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  linkedin_url: z.string().trim().url("Enter a valid LinkedIn URL."),
  portfolio_url: optionalUrl,
  github_url: optionalUrl,
  role_id: z.string().uuid("Select a valid role."),
  resume: z
    .instanceof(File, { message: "Resume is required." })
    .refine((file) => file.size > 0, "Resume is required.")
    .refine((file) => file.size <= MAX_RESUME_SIZE_BYTES, "Resume must be 5 MB or smaller.")
    .refine(
      (file) => isSupportedResumeFile(file.name, file.type),
      "Resume must be a PDF or DOCX file."
    )
});

/**
 * Validation for the client-side form state. The shape differs slightly from
 * the API schema because React form state uses camelCase field names.
 */
export const clientApplicationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address."),
  linkedinUrl: z.string().trim().url("Enter a valid LinkedIn URL."),
  portfolioUrl: optionalUrl,
  githubUrl: optionalUrl,
  roleId: z.string().uuid("Select a valid role."),
  resume: z
    .instanceof(File, { message: "Resume is required." })
    .refine((file) => file.size > 0, "Resume is required.")
    .refine((file) => file.size <= MAX_RESUME_SIZE_BYTES, "Resume must be 5 MB or smaller.")
    .refine(
      (file) => isSupportedResumeFile(file.name, file.type),
      "Resume must be a PDF or DOCX file."
    )
});

/**
 * Converts Zod issues into a flat `{ fieldName: message }` shape that the
 * application form can render without knowing Zod internals.
 */
export function formatZodErrors(error: ZodError) {
  return error.issues.reduce<Record<string, string>>((accumulator, issue) => {
    const key = issue.path[0];

    if (typeof key === "string" && !accumulator[key]) {
      accumulator[key] = issue.message;
    }

    return accumulator;
  }, {});
}
