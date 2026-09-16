import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtimeEnvironment } from "../scripts/runtime-env.mjs";
import { databaseUrl } from "../lib/database-url.mjs";

test("managed schema overrides stale public URL for both migrations and Prisma", () => {
  const env = { DATABASE_URL: "postgresql://owner:secret@postgres/planner?schema=public&sslmode=require", DATABASE_SCHEMA: "project_app" };
  const runtime = runtimeEnvironment(env);
  assert.equal(runtime.DATABASE_URL, databaseUrl(env));
  const url = new URL(runtime.DATABASE_URL!);
  assert.equal(url.searchParams.get("schema"), "project_app");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.username, "owner");
  assert.equal(url.pathname, "/planner");
});

test("managed DB never silently falls back to public when its schema is missing", () => {
  assert.throws(() => databaseUrl({ DATABASE_HOST: "postgres", DATABASE_URL: "postgresql://postgres/planner" }), /DATABASE_SCHEMA/);
  assert.equal(databaseUrl({}), undefined); // Build does not require DB credentials.
});

test("Heimdall DB and secret files become correctly escaped runtime variables", () => {
  const folder = mkdtempSync(join(tmpdir(), "timebox-env-"));
  try {
    const password = join(folder, "password");
    const secret = join(folder, "secret");
    writeFileSync(password, "p@ss:/?#word\n");
    writeFileSync(secret, "secret-value\n");
    const env = runtimeEnvironment({ DATABASE_HOST: "postgres", DATABASE_PORT: "5432", DATABASE_USER: "owner",
      DATABASE_NAME: "planner", DATABASE_SCHEMA: "app", DATABASE_PASSWORD_FILE: password, AUTH_SECRET_FILE: secret });
    const url = new URL(env.DATABASE_URL!);
    assert.equal(decodeURIComponent(url.password), "p@ss:/?#word");
    assert.equal(url.searchParams.get("schema"), "app");
    assert.equal(env.AUTH_SECRET, "secret-value");
    assert.equal(runtimeEnvironment({ DATABASE_URL: "postgresql://existing" }).DATABASE_URL, "postgresql://existing");
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
