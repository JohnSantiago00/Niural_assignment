/**
 * Shared login page for the internal admin experience. Authentication is
 * handled by Supabase Auth, while authorization is handled separately through
 * the `admin_users` allowlist.
 */
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAuthState } from "@/lib/auth/authorization";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export const revalidate = 0;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath =
    resolvedSearchParams.next && resolvedSearchParams.next.startsWith("/admin")
      ? resolvedSearchParams.next
      : "/admin";
  const authState = await getAuthState();

  if (authState.user && authState.isAdmin) {
    redirect(nextPath);
  }

  if (authState.user && !authState.isAdmin) {
    redirect("/not-authorized");
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="rounded-[2rem] border border-line bg-panel p-10 shadow-card">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Internal Sign In
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
          Sign in to the hiring dashboard.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          This login uses Supabase Auth for identity. Admin access is granted
          only to authenticated users whose email is listed in the internal
          admin allowlist.
        </p>

        <LoginForm nextPath={nextPath} />
      </div>
    </section>
  );
}
