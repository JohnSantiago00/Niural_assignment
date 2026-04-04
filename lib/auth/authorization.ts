/**
 * Authentication and authorization helpers for the internal admin area. Supabase
 * Auth handles identity, and the small `admin_users` table determines which
 * authenticated users are allowed into `/admin`.
 */
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type AuthState = {
  user: User | null;
  isAdmin: boolean;
};

async function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check admin authorization: ${error.message}`);
  }

  return Boolean(data);
}

/**
 * Reads the current authenticated user from Supabase Auth and checks whether
 * that user is present in the admin allowlist table.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false };
  }

  return {
    user,
    isAdmin: await isAdminEmail(user.email)
  };
}

/**
 * Used by admin pages after authentication has already been enforced in the
 * proxy. Logged-in but unauthorized users are redirected to a clean denial page.
 */
export async function requireAdminUser() {
  const { user, isAdmin } = await getAuthState();

  if (!user) {
    redirect("/login");
  }

  if (!isAdmin) {
    redirect("/not-authorized");
  }

  return user;
}

