import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { runtimeEnvironment } from "./runtime-env.mjs";

const quote = (name) => `"${name.replaceAll('"', '""')}"`;

/** Apply repository SQL atomically, reusing the existing Prisma migration ledger.
 * @param {{env?: Record<string, string | undefined>, directory?: string, log?: (message: string) => void}} options
 */
export async function runMigrations({ env = process.env, directory = resolve("prisma/migrations"), log = console.log } = {}) {
  const configured = runtimeEnvironment(env);
  if (!configured.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const url = new URL(configured.DATABASE_URL);
  const schema = url.searchParams.get("schema") || "public";
  const ledger = `${quote(schema)}."_prisma_migrations"`;
  url.searchParams.delete("schema");
  const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '60s'");
    await client.query("SET LOCAL statement_timeout = '120s'");
    // Same lock as Prisma Migrate. Concurrent candidates cannot apply SQL twice.
    await client.query("SELECT pg_advisory_xact_lock(72707369)");
    const permission = await client.query(
      "SELECT nspname FROM pg_namespace WHERE nspname = $1 AND has_schema_privilege(oid, 'USAGE') AND has_schema_privilege(oid, 'CREATE')", [schema]);
    if (permission.rowCount !== 1) throw new Error(`Target schema ${schema} is missing or lacks USAGE/CREATE privileges`);
    await client.query("SELECT set_config('search_path', $1, true)", [quote(schema)]);
    // Fully qualify every ledger operation; never rely on the role's search_path.
    await client.query(`CREATE TABLE IF NOT EXISTS ${ledger} (
      id VARCHAR(36) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    )`);
    const { rows: history } = await client.query(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM ${ledger}`);
    if (history.some((row) => !row.finished_at && !row.rolled_back_at)) {
      throw new Error("An unfinished migration exists; inspect its failure before retrying");
    }
    const names = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    const files = await Promise.all(names.map(async (name) => {
      const sql = await readFile(resolve(directory, name, "migration.sql"), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") };
    }));
    const applied = history.filter((row) => row.finished_at && !row.rolled_back_at);
    for (const row of applied) {
      const file = files.find((entry) => entry.name === row.migration_name);
      if (!file || file.checksum !== row.checksum) {
        throw new Error(`Applied migration differs from this release: ${row.migration_name}`);
      }
    }
    const pending = files.filter((file) => !applied.some((row) => row.migration_name === file.name));
    for (const file of pending) {
      log(`Applying migration ${file.name} in schema ${schema}`);
      // Repository migrations must contain transactional DDL, without BEGIN/COMMIT.
      await client.query(file.sql);
      await client.query(`INSERT INTO ${ledger} (id, checksum, migration_name, finished_at, applied_steps_count)
        VALUES ($1, $2, $3, now(), 1)`, [randomUUID(), file.checksum, file.name]);
    }
    await client.query("COMMIT");
    log(`Migrations ready: schema=${schema}, applied=${pending.length}, existing=${applied.length}`);
    return { applied: pending.length, existing: applied.length };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations().catch((error) => {
    console.error("Database migration failed:", error.message);
    process.exitCode = 1;
  });
}
