/**
 * Read-only Supabase queries used by the public Phase A pages. These helpers
 * keep page components focused on rendering while centralizing role fetch logic.
 */
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils/uuid";
import type { RoleRecord } from "@/types/database";

/**
 * Fetches all roles that should be publicly visible on the careers page.
 */
export const getOpenRoles = cache(async (): Promise<RoleRecord[]> => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load roles: ${error.message}`);
  }

  return data ?? [];
});

/**
 * Fetches a single role for the public role detail page. An invalid UUID is
 * treated as "not found" instead of making Postgres parse a bad identifier.
 */
export async function getRoleById(roleId: string): Promise<RoleRecord | null> {
  if (!isUuid(roleId)) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("id", roleId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load role: ${error.message}`);
  }

  return data;
}
