"use client";

/**
 * Renders the public application form. This component owns browser UX only:
 * local form state, client-side validation, and the POST request to the
 * application API. All durable business logic still lives on the server.
 */
import type { FormEvent, HTMLInputTypeAttribute } from "react";
import { useMemo, useRef, useState } from "react";
import { MAX_RESUME_SIZE_BYTES } from "@/lib/utils/resume";
import { clientApplicationSchema, formatZodErrors } from "@/lib/utils/validation";
import { cn } from "@/lib/utils/cn";
import { Button, Eyebrow, Pill, SurfaceCard } from "@/components/public-ui";
import type { ApplicationApiResponse } from "@/types/api";
import type { RoleRecord } from "@/types/database";

type ApplicationFormProps = {
  roles: RoleRecord[];
  initialRoleId?: string;
  lockedRole?: RoleRecord | null;
};

type FormState = {
  fullName: string;
  email: string;
  linkedinUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  roleId: string;
  resume: File | null;
};

const defaultState = (initialRoleId?: string): FormState => ({
  fullName: "",
  email: "",
  linkedinUrl: "",
  portfolioUrl: "",
  githubUrl: "",
  roleId: initialRoleId ?? "",
  resume: null
});

export function ApplicationForm({
  roles,
  initialRoleId,
  lockedRole
}: ApplicationFormProps) {
  const hasRoles = roles.length > 0;
  const isRoleLocked = Boolean(lockedRole);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultState(initialRoleId));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === formState.roleId),
    [formState.roleId, roles]
  );

  const updateField = (field: keyof FormState, value: string | File | null) => {
    setFormState((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  /**
   * Validates the local form state, then sends one multipart request to the
   * backend. The API route takes over after this and performs all
   * database/storage/email work.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitMessage(null);

    const parsed = clientApplicationSchema.safeParse(formState);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const payload = new FormData();
    payload.append("full_name", parsed.data.fullName);
    payload.append("email", parsed.data.email);
    payload.append("linkedin_url", parsed.data.linkedinUrl);
    payload.append("portfolio_url", parsed.data.portfolioUrl ?? "");
    payload.append("github_url", parsed.data.githubUrl ?? "");
    payload.append("role_id", parsed.data.roleId);
    payload.append("resume", parsed.data.resume);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        body: payload
      });

      const result = (await response.json()) as ApplicationApiResponse;

      if (!result.success) {
        setSubmitError(result.error.message ?? "Unable to submit your application.");
        return;
      }

      if (!response.ok) {
        setSubmitError("Unable to submit your application.");
        return;
      }

      setSubmitMessage(
        result.data.emailStatus === "sent"
          ? "Application submitted successfully. A confirmation email is on the way."
          : "Application submitted successfully. We saved your application, but the confirmation email could not be sent."
      );
      setFormState(defaultState(initialRoleId));
      if (resumeInputRef.current) {
        resumeInputRef.current.value = "";
      }
    } catch {
      setSubmitError("Something went wrong while submitting the form. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SurfaceCard className="p-6 sm:p-8">
      <form onSubmit={handleSubmit}>
        {lockedRole ? (
          <div className="mb-8 rounded-3xl border border-accent/20 bg-accent/5 px-5 py-5">
            <Eyebrow>Selected role</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-ink">
              {lockedRole.title}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>{lockedRole.team}</Pill>
              <Pill>{lockedRole.location}</Pill>
              <Pill>{lockedRole.remote_status}</Pill>
              <Pill>{lockedRole.experience_level}</Pill>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              We&apos;ve locked this role in for your application.
            </p>
          </div>
        ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Field
          label="Full name"
          name="fullName"
          value={formState.fullName}
          onChange={(value) => updateField("fullName", value)}
          error={fieldErrors.fullName}
          required
        />
        <Field
          label="Email"
          name="email"
          type="email"
          value={formState.email}
          onChange={(value) => updateField("email", value)}
          error={fieldErrors.email}
          required
        />
        <Field
          label="LinkedIn URL"
          name="linkedinUrl"
          placeholder="https://linkedin.com/in/..."
          value={formState.linkedinUrl}
          onChange={(value) => updateField("linkedinUrl", value)}
          error={fieldErrors.linkedinUrl}
          required
        />
        <Field
          label="Portfolio URL"
          name="portfolioUrl"
          placeholder="https://your-portfolio.com"
          value={formState.portfolioUrl}
          onChange={(value) => updateField("portfolioUrl", value)}
          error={fieldErrors.portfolioUrl}
        />
        <Field
          label="GitHub URL"
          name="githubUrl"
          placeholder="https://github.com/your-handle"
          value={formState.githubUrl}
          onChange={(value) => updateField("githubUrl", value)}
          error={fieldErrors.githubUrl}
        />

        {isRoleLocked && selectedRole ? (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">Role</label>
            <div className="rounded-2xl border border-line bg-white/80 px-4 py-3 text-sm text-slate-800 shadow-sm">
              <p className="font-medium">{selectedRole.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedRole.team} · {selectedRole.location} · {selectedRole.remote_status} ·{" "}
                {selectedRole.experience_level}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              This role was preselected from the page you came from.
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="roleId" className="mb-2 block text-sm font-medium text-slate-800">
              Role
            </label>
            <select
              id="roleId"
              name="roleId"
              value={formState.roleId}
              onChange={(event) => updateField("roleId", event.target.value)}
              className={inputClassName(Boolean(fieldErrors.roleId))}
              required
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.title} · {role.team}
                </option>
              ))}
            </select>
            {selectedRole ? (
              <p className="mt-2 text-xs text-slate-500">
                {selectedRole.location} · {selectedRole.remote_status} ·{" "}
                {selectedRole.experience_level}
              </p>
            ) : null}
            {fieldErrors.roleId ? (
              <p className="mt-2 text-sm text-red-600">{fieldErrors.roleId}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="resume" className="mb-2 block text-sm font-medium text-slate-800">
          Resume
        </label>
        <input
          ref={resumeInputRef}
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => updateField("resume", event.target.files?.[0] ?? null)}
          className={cn(
            "block w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200",
            fieldErrors.resume ? "border-red-500" : "focus:border-accent"
          )}
        />
        <p className="mt-2 text-xs text-slate-500">
          Accepted formats: PDF or DOCX up to {Math.round(MAX_RESUME_SIZE_BYTES / 1024 / 1024)} MB.
        </p>
        {fieldErrors.resume ? (
          <p className="mt-2 text-sm text-red-600">{fieldErrors.resume}</p>
        ) : null}
      </div>

      {submitError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      {submitMessage ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {submitMessage}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={isSubmitting || !hasRoles}
        size="lg"
        className="mt-8 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Submitting..." : hasRoles ? "Submit application" : "No open roles available"}
      </Button>
      </form>
    </SurfaceCard>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  type?: HTMLInputTypeAttribute;
};

/**
 * Small shared input renderer for the plain text fields in the form.
 */
function Field({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  required,
  type = "text"
}: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName(Boolean(error))}
        required={required}
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

/**
 * Keeps the input styling logic in one place so field components stay readable.
 */
function inputClassName(hasError: boolean) {
  return cn(
    "w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400",
    hasError ? "border-red-500" : "border-line focus:border-accent focus:ring-4 focus:ring-accent/10"
  );
}
