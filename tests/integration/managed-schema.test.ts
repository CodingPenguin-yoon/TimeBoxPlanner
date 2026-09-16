import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { prisma } from "../../lib/db";
import { GET as health } from "../../app/api/health/route";

if (!process.env.DATABASE_URL?.includes("timebox_test")) throw new Error("Use a dedicated database named timebox_test");
after(() => prisma.$disconnect());

test("restricted managed role can use auth tables despite a stale public connection URL", {
  skip: process.env.TEST_RESTRICTED_SCHEMA !== "true",
}, async () => {
  assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get("schema"), "public");
  assert.ok(process.env.DATABASE_SCHEMA && process.env.DATABASE_SCHEMA !== "public");
  await assert.rejects(prisma.$queryRaw`SELECT 1 FROM public."User" LIMIT 1`, /permission denied/);
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });
  try {
    const providerAccountId = randomUUID();
    await prisma.account.create({ data: { userId: user.id, type: "oauth", provider: "google", providerAccountId } });
    const account = await prisma.account.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId } }, include: { user: true } });
    assert.equal(account?.user.id, user.id);
    const token = randomUUID();
    await prisma.session.create({ data: { userId: user.id, sessionToken: token, expires: new Date(Date.now() + 60000) } });
    assert.equal((await prisma.session.findUnique({ where: { sessionToken: token } }))?.userId, user.id);
    assert.equal((await health()).status, 200);
  } finally { await prisma.user.delete({ where: { id: user.id } }); }
});


test("health rejects a reachable DB whose public schema is inaccessible", {
  skip: process.env.TEST_RESTRICTED_SCHEMA !== "true",
}, () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "-e",
    'require("./app/api/health/route.ts").GET().then(r => { console.log("HEALTH_STATUS=" + r.status); return require("./lib/db.ts").prisma.$disconnect(); })',
  ], { env: { ...process.env, DATABASE_SCHEMA: "", DATABASE_HOST: "" }, encoding: "utf8" });
  assert.match(output, /HEALTH_STATUS=503/);
});
