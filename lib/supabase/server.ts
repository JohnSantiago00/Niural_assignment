import { createClient } from "@supabase/supabase-js";
import { getRequiredEnv, getSupabasePublishableKey } from "@/lib/utils/env";
import type { Database } from "@/types/database";

export function createSupabaseServerClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getSupabasePublishableKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export function createSupabaseAdminClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
