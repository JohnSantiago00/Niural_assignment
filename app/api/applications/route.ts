/**
 * Handles the public application submission endpoint. The browser sends one
 * multipart request containing text fields plus the resume file, and this route
 * validates/parses it before handing off to the application workflow.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { submitApplication } from "@/lib/applications/submit-application";
import { isApiError } from "@/lib/utils/api";
import { formatZodErrors, applicationPayloadSchema } from "@/lib/utils/validation";
import type { ApplicationApiResponse } from "@/types/api";

/**
 * Normalizes `FormData.get()` output into the exact shape expected by the
 * server validation schema. Keeping this close to the route makes request
 * parsing easy to explain in an interview.
 */
function readApplicationPayload(formData: FormData) {
  return {
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    linkedin_url: formData.get("linkedin_url"),
    portfolio_url: formData.get("portfolio_url"),
    github_url: formData.get("github_url"),
    role_id: formData.get("role_id"),
    resume: formData.get("resume")
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const parsed = applicationPayloadSchema.parse(readApplicationPayload(formData));

    const result = await submitApplication(parsed);

    return NextResponse.json<ApplicationApiResponse>(
      {
        success: true,
        data: result
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors = formatZodErrors(error);
      // The client currently renders one top-level error banner, so return the
      // first validation issue in a clean, human-readable form.
      const firstError = Object.values(fieldErrors)[0] ?? "Invalid request payload.";

      return NextResponse.json<ApplicationApiResponse>(
        {
          success: false,
          error: {
            code: "validation_error",
            message: firstError
          }
        },
        { status: 400 }
      );
    }

    if (isApiError(error)) {
      return NextResponse.json<ApplicationApiResponse>(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        },
        { status: error.status }
      );
    }

    console.error("Unhandled application submission error", error);

    return NextResponse.json<ApplicationApiResponse>(
      {
        success: false,
        error: {
          code: "internal_error",
          message: "Something went wrong while saving the application."
        }
      },
      { status: 500 }
    );
  }
}
