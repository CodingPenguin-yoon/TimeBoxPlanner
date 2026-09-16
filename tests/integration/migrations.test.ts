import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { runMigrations } from "../../scripts/migrate.mjs";
import { resolveDatabaseEnvironment } from "../../scripts/database-connection.mjs";

const adminUrl = process.env.TEST_MIGRATION_ADMIN_URL;
test("migration runner preserves Prisma history, serializes retries and rolls failed DDL back", { skip: !adminUrl }, async () => {
  if (!adminUrl?.includes("timebox_test")) throw new Error("Use a dedicated timebox_test database");
  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  const suffix = randomUUID().replaceAll("-", "");
  const role = `migration_${suffix}`;
  const schema = `schema_${suffix}`;
  const fresh = `fresh_${suffix}`;
  const directory = mkdtempSync(join(tmpdir(), "timebox-migrations-"));
  const migration = "20260916000000_postgres_accounts";
  mkdirSync(join(directory, migration));
  copyFileSync(`prisma/migrations/${migration}/migration.sql`, join(directory, migration, "migration.sql"));
  const url = new URL(adminUrl);
  url.username = role;
  url.password = "local-migration-test-password";
  url.searchParams.set("schema", schema);
  const env = { DATABASE_URL: url.toString(), DATABASE_SCHEMA: schema };
  const log = () => {};
  try {
    await admin.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN PASSWORD 'local-migration-test-password'`);
    for (const name of [schema, fresh]) {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${name}"`);
      await admin.$executeRawUnsafe(`GRANT USAGE, CREATE ON SCHEMA "${name}" TO "${role}"`);
    }
    await admin.$executeRawUnsafe(`ALTER ROLE "${role}" IN DATABASE "timebox_test" SET search_path TO "${schema}", pg_catalog`);
    const staleUrl = new URL(url);
    staleUrl.searchParams.set("schema", "public");
    const staleEnv = { DATABASE_URL: staleUrl.toString(), DATABASE_SCHEMA: "public" };
    const resolved = await resolveDatabaseEnvironment(staleEnv, log);
    assert.equal(resolved.DATABASE_SCHEMA, schema);
    assert.equal(new URL(resolved.DATABASE_URL).searchParams.get("schema"), schema);
    await assert.rejects(resolveDatabaseEnvironment({ ...env, DATABASE_SCHEMA: "missing_explicit_schema" }, log), /unavailable/);
    // Import a real ledger created by Prisma CLI, not a mock or fabricated baseline.
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
      env: { ...process.env, ...env }, stdio: "pipe",
    });
    assert.deepEqual(await runMigrations({ env: staleEnv, directory, log }), { applied: 0, existing: 1 });
    const app = new PrismaClient({ datasourceUrl: resolved.DATABASE_URL });
    try { assert.deepEqual(await app.account.findMany(), []); } finally { await app.$disconnect(); }
    const results = await Promise.all([
      runMigrations({ env: { ...env, DATABASE_SCHEMA: fresh }, directory, log }),
      runMigrations({ env: { ...env, DATABASE_SCHEMA: fresh }, directory, log }),
    ]);
    assert.equal(results.reduce((sum, value) => sum + value.applied, 0), 1);
    mkdirSync(join(directory, "20260917000000_probe"));
    writeFileSync(join(directory, "20260917000000_probe/migration.sql"), 'CREATE TABLE "MigrationProbe" (id INTEGER);');
    mkdirSync(join(directory, "20260918000000_bad"));
    writeFileSync(join(directory, "20260918000000_bad/migration.sql"), 'CREATE TABLE "RolledBackProbe" (id INTEGER); SELECT missing_column FROM "RolledBackProbe";');
    await assert.rejects(runMigrations({ env, directory, log }), /missing_column/);
    const tables = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*) FROM pg_tables WHERE schemaname = '${schema}' AND tablename IN ('MigrationProbe', 'RolledBackProbe')`);
    assert.equal(tables[0].count, BigInt(0));
    rmSync(join(directory, "20260918000000_bad"), { recursive: true });
    assert.deepEqual(await runMigrations({ env, directory, log }), { applied: 1, existing: 1 });
    writeFileSync(join(directory, "20260917000000_probe/migration.sql"), '-- modified after application');
    await assert.rejects(runMigrations({ env, directory, log }), /differs from this release/);
  } finally {
    for (const name of [schema, fresh]) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    await admin.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    await admin.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
