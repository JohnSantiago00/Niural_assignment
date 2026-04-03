type EnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SUPABASE_RESUME_BUCKET"
  | "RESEND_API_KEY"
  | "RESEND_FROM_EMAIL";

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
