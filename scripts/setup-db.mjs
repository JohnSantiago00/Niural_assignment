import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import postgres from "postgres";

const root = process.cwd();
const migrationsDir = resolve(root, "supabase", "migrations");

function loadEnvFile(fileName) {
  const filePath = resolve(root, fileName);

  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    missingEnv.push(name);
  }

  return value;
}

function runSeedScript() {
  return new Promise((resolveSeed, rejectSeed) => {
    const child = spawn(process.execPath, [resolve(root, "scripts", "seed-demo.mjs")], {
      cwd: root,
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", rejectSeed);
    child.on("close", (code) => {
      if (code === 0) {
        resolveSeed();
        return;
      }

      rejectSeed(new Error(`Seed script exited with code ${code}.`));
    });
  });
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const missingEnv = [];
const databaseUrl = requireEnv("SUPABASE_DB_URL");
requireEnv("NEXT_PUBLIC_SUPABASE_URL");
requireEnv("SUPABASE_SERVICE_ROLE_KEY");

if (missingEnv.length > 0) {
  console.error("Missing required database setup env vars:");
  for (const name of missingEnv) {
    console.error(`- ${name}`);
  }
  console.error(
    "\nCopy .env.example to .env.local and fill the required Supabase values before running npm run db:setup."
  );
  if (missingEnv.includes("SUPABASE_DB_URL")) {
    console.error(
      "SUPABASE_DB_URL is the direct Postgres connection string from Supabase Project Settings -> Database."
    );
  }
  process.exit(1);
}

if (databaseUrl.includes("[YOUR-PASSWORD]")) {
  console.error(
    "SUPABASE_DB_URL still contains [YOUR-PASSWORD]. Replace it with the database password from Supabase Project Settings -> Database before running npm run db:setup."
  );
  process.exit(1);
}

const databaseHost = new URL(databaseUrl).hostname;
const useSsl = !["localhost", "127.0.0.1", "::1"].includes(databaseHost);

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: useSsl ? "require" : false,
  onnotice: () => {
    // Keep setup output focused on migration names and actionable failures.
  }
});

async function ensureMigrationTable() {
  await sql`
    create table if not exists public.local_schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default timezone('utc', now())
    )
  `;
}

async function hasMigrationRun(filename) {
  const rows = await sql`
    select filename
    from public.local_schema_migrations
    where filename = ${filename}
    limit 1
  `;

  return rows.length > 0;
}

async function applyMigration(filename) {
  const filePath = resolve(migrationsDir, filename);
  const contents = readFileSync(filePath, "utf8");

  await sql.begin(async (transaction) => {
    // The migration files are trusted project SQL. postgres.unsafe is used here
    // because migrations contain DDL and multiple statements that cannot be
    // represented as parameterized tagged-template queries.
    await transaction.unsafe(contents);
    await transaction`
      insert into public.local_schema_migrations (filename)
      values (${filename})
      on conflict (filename) do nothing
    `;
  });
}

async function main() {
  console.log("Setting up database...");
  await ensureMigrationTable();

  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql") && !fileName.endsWith(" 2.sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of migrationFiles) {
    if (await hasMigrationRun(filename)) {
      console.log(`Skipping ${filename} (already applied)`);
      continue;
    }

    console.log(`Applying ${filename}`);

    try {
      await applyMigration(filename);
    } catch (error) {
      console.error(`\nMigration failed: ${filename}`);
      console.error(error instanceof Error ? error.message : error);
      console.error("\nDatabase setup stopped before seeding.");
      process.exitCode = 1;
      return;
    }
  }

  console.log("Migrations complete. Seeding demo data...");
  await runSeedScript();
  console.log("Database setup complete. Ready to run the app.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 });
  });
