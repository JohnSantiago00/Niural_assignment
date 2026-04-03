# Niural Assignment

Phase A implements a simple, interview-friendly candidate onboarding foundation with:

- Next.js App Router + TypeScript + Tailwind CSS
- Supabase Postgres + Storage
- Resend confirmation emails
- A deterministic `POST /api/applications` workflow for resume upload, record creation, and confirmation handling

## Phase A features

- Public careers page backed by live `roles` data from Supabase
- Role detail page with responsibilities, requirements, and direct apply flow
- Application form with client and server validation
- Resume upload to a private Supabase Storage bucket
- Creation of `applications`, `candidates`, and `audit_logs` records
- Confirmation email via Resend, without rolling back saved data if email delivery fails

## Project structure

```text
app/
  (public)/
    careers/
    careers/[roleId]/
    apply/
  admin/
  api/applications/
components/
lib/
  applications/
  email/
  supabase/
  utils/
supabase/migrations/
docs/
types/
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_RESUME_BUCKET=candidate-resumes
RESEND_API_KEY=
RESEND_FROM_EMAIL=Hiring Team <hiring@example.com>
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is used only on the server for DB writes and private storage uploads.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is used for public read-only Supabase access in the app.
- `SUPABASE_RESUME_BUCKET` defaults to `candidate-resumes`, which matches the migration.
- If Resend env vars are missing, applications still save successfully and the API reports that email was skipped.
- The included `.env.local` is prefilled with the Supabase URL and publishable key you shared, but you still need to add `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` for full submission testing.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Apply the Supabase SQL in order:

- [0001_phase_a_schema.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0001_phase_a_schema.sql)
- [0002_seed_roles.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0002_seed_roles.sql)

You can run them in the Supabase SQL editor or through the Supabase CLI if you already have it configured.

3. Start the app:

```bash
npm run dev
```

4. Open [http://localhost:3000/careers](http://localhost:3000/careers)

## Submission flow

`POST /api/applications` performs the Phase A workflow in this order:

1. Validate payload and resume file.
2. Confirm the role exists and is still open.
3. Prevent duplicate applications for the same `(role_id, email)`.
4. Upload the resume to Supabase Storage.
5. Insert the application row.
6. Insert the candidate row.
7. Insert an audit log entry.
8. Send the confirmation email.

If email sending fails, the saved application stays intact. If a DB write fails after upload, the endpoint deletes the uploaded file and rolls back the inserted application row.

## Useful files

- [Application route](/Users/nick/Desktop/Niural_assignment/app/api/applications/route.ts)
- [Submission workflow](/Users/nick/Desktop/Niural_assignment/lib/applications/submit-application.ts)
- [Validation helpers](/Users/nick/Desktop/Niural_assignment/lib/utils/validation.ts)
- [Supabase schema](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0001_phase_a_schema.sql)
- [Phase A notes](/Users/nick/Desktop/Niural_assignment/docs/phase-a-notes.md)
