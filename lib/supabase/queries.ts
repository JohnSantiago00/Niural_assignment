import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoleRecord } from "@/types/database";

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

export async function getRoleById(roleId: string): Promise<RoleRecord | null> {
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
