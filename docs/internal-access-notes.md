# Internal Access Notes

## Why we moved away from the env access-code gate

The first admin protection pass improved safety, but it still felt artificial:

- the login experience was a single shared access code
- there was no real user identity
- authentication and authorization were collapsed into one step
- the header could only show `Admin` after the special cookie existed

For a stronger internal-tool MVP, it was better to let people sign in as real users and then decide separately whether they are allowed into the admin area.

## What replaced it

The project now uses:

- Supabase Auth for authentication
- a small `admin_users` table for authorization
- a shared `/login` page
- Supabase SSR session handling for Next.js App Router
- proxy-based protection for unauthenticated `/admin` access

## How login works

1. A user visits `/login`.
2. They sign in with email and password through Supabase Auth.
3. Supabase sets the auth session.
4. The Next.js proxy refreshes and forwards that session for server-rendered requests.
5. Server components can read the authenticated user through the Supabase SSR client.

This means the admin area now uses a real authenticated identity instead of a shared password.

## How admin authorization works

Authentication alone is not enough. A signed-in user only becomes an admin if
their email exists in `public.admin_users`.

The `admin_users` table is intentionally small:

- `id`
- `email`
- `created_at`

Authorization is checked server-side using the service-role Supabase client. If a user is authenticated but their email is not in `admin_users`, they are redirected to a clean `/not-authorized` page.

## Why this is a stronger MVP

This model is still small, but it is more realistic than the access-code gate:

- users sign in as themselves
- auth and authorization are separated
- internal access is explicit and auditable through a table
- navigation can feel more natural:
  - logged out: `Login`
  - logged in admin: `Admin`, `Logout`
  - logged in non-admin: `Logout`

## What a more production-ready version would look like later

If the system continued beyond the take-home prototype, the next step would be:

- proper admin management UI
- role-based authorization beyond a single admin allowlist
- invite flows or SSO
- stronger audit logging around authorization changes
- row-level security policies that align with user roles
- potentially organization-backed identity such as company SSO

For this project, Supabase Auth plus a small `admin_users` table is the best balance between realism and simplicity.
