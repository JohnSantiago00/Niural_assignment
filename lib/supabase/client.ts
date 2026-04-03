"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getRequiredEnv } from "@/lib/utils/env";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getSupabasePublishableKey()
  );
}

