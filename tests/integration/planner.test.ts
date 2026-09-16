import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/db";
import { readPlanner, writePlanner, clearPlanner, PlannerConflict } from "../../lib/planner-service";

if (!process.env.DATABASE_URL?.includes("timebox_test")) throw new Error("Use a dedicated database named timebox_test");
const users: string[] = [];
after(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect(); });

test("two accounts remain isolated; task identity, ordering, timestamps, conflict rollback and deletion", async () => {
  const a = await prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });
  const b = await prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });
  users.push(a.id, b.id);
  const date = "2026-09-16";
  const t1 = { id: randomUUID(), title: "A private task", timeSpan: 60, isBig3: true };
  const t2 = { ...t1, id: randomUUID(), title: "Second task", isBig3: false };
  const data = { tasks: [t1, t2], todayTime: { notes: "Private notes" } };
  assert.equal(await writePlanner(a.id, date, data, 0), 1);
  const created = await prisma.task.findUniqueOrThrow({ where: { id: t1.id } });
  assert.deepEqual(await readPlanner(b.id, date), { data: null, revision: 0 });
  const bt = { ...t1, id: randomUUID(), title: "B private task" };
  await writePlanner(b.id, date, { tasks: [bt], todayTime: {} }, 0);
  assert.equal((await readPlanner(a.id, date)).data?.tasks[0].title, "A private task");
  await assert.rejects(writePlanner(b.id, date, data, 1), PlannerConflict);
  assert.equal((await readPlanner(b.id, date)).revision, 1);
  assert.equal((await readPlanner(b.id, date)).data?.tasks[0].id, bt.id);
  await writePlanner(a.id, date, { ...data, tasks: [t2, { ...t1, title: "Updated" }] }, 1);
  const updated = await prisma.task.findUniqueOrThrow({ where: { id: t1.id } });
  assert.equal(updated.createdAt.getTime(), created.createdAt.getTime());
  assert.equal((await readPlanner(a.id, date)).data?.tasks[0].id, t2.id);
  await assert.rejects(writePlanner(a.id, date, data, 1), PlannerConflict);
  const competing = await Promise.allSettled([
    writePlanner(a.id, date, data, 2), writePlanner(a.id, date, data, 2),
  ]);
  assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
  await assert.rejects(clearPlanner(a.id, date, 2), PlannerConflict);
  await clearPlanner(a.id, date, 3);
  assert.equal((await readPlanner(a.id, date)).data?.tasks.length, 0);
  assert.equal((await readPlanner(b.id, date)).data?.tasks[0].id, bt.id);
  await assert.rejects(writePlanner(a.id, date, data, 0), PlannerConflict);
});

const base = process.env.TEST_BASE_URL;
test("HTTP auth, CSRF, validation, private cache and session invalidation", { skip: !base }, async () => {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@example.com` } });
  users.push(user.id);
  const token = randomUUID();
  await prisma.session.create({ data: { userId: user.id, sessionToken: token, expires: new Date(Date.now() + 60000) } });
  const cookie = `authjs.session-token=${token}`;
  const url = `${base}/api/planner?date=2026-09-17`;
  for (const method of ["GET", "POST", "DELETE"]) assert.equal((await fetch(url, { method })).status, 401);
  const privateRead = await fetch(url, { headers: { cookie } });
  assert.equal(privateRead.status, 200);
  assert.match(privateRead.headers.get("cache-control")!, /no-store/);
  assert.equal((await fetch(`${base}/api/planner?date=2026-02-30`, { headers: { cookie } })).status, 400);
  const payload = { ownerId: user.id, date: "2026-09-17", revision: 0, data: { tasks: [], todayTime: {} } };
  const headers = { cookie, origin: base!, "Content-Type": "application/json" };
  assert.equal((await fetch(url, { method: "POST", headers: { ...headers, origin: "https://evil.example" }, body: JSON.stringify(payload) })).status, 403);
  assert.equal((await fetch(url, { method: "POST", headers, body: "{" })).status, 400);
  assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...payload, ownerId: "previous-account" }) })).status, 409);
  assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) })).status, 200);
  assert.equal((await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) })).status, 409);
  assert.equal((await fetch(`${url}&revision=1&ownerId=${user.id}`, { method: "DELETE", headers })).status, 200);
  await prisma.session.delete({ where: { sessionToken: token } });
  assert.equal((await fetch(url, { headers: { cookie } })).status, 401);
  const home = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(home.status, 307);
  assert.equal(home.headers.get("location"), "/login");
});
