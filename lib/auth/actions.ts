"use server";

/**
 * Server action for logging out the authenticated Supabase user from the
 * internal dashboard experience.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutUser() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login" as Route);
}

