type EnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  | "GEMINI_API_KEY"
  | "GEMINI_MODEL"
  | "APP_BASE_URL"
  | "GOOGLE_CLIENT_EMAIL"
  | "GOOGLE_PRIVATE_KEY"
  | "GOOGLE_CALENDAR_ID"
  | "GOOGLE_CALENDAR_INTERVIEWER_NAME"
  | "GOOGLE_CALENDAR_INTERVIEWER_EMAIL"
  | "GOOGLE_IMPERSONATED_USER_EMAIL"
  | "GOOGLE_TIMEZONE"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_RESUME_BUCKET"
  | "RESEND_API_KEY"
  | "RESEND_FROM_EMAIL"
  | "OFFER_ALERT_EMAIL"
  | "SLACK_BOT_TOKEN"
  | "SLACK_SIGNING_SECRET"
  | "SLACK_ADMIN_TOKEN"
  | "SLACK_TEAM_ID"
  | "SLACK_INVITE_CHANNEL_IDS"
  | "SLACK_WORKSPACE_INVITE_URL"
  | "SLACK_HR_CHANNEL_ID"
  | "SLACK_ONBOARDING_CHANNEL_ID"
  | "SLACK_ONBOARDING_RESOURCE_LINKS";

export function getRequiredEnv(key: EnvKey) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export function getOptionalEnv(key: EnvKey) {
  return process.env[key];
}

export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  return value;
}

export function getSupabasePublishableKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!value) {
    throw new Error(
      "Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
    );
  }

  return value;
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}
