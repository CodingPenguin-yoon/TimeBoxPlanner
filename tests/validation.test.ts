import { test } from "node:test";
import assert from "node:assert/strict";
import { dateSchema, savePlannerSchema } from "../lib/planner-validation";
import { isEmailAllowed } from "../lib/access-policy";

test("calendar dates are validated, including leap years", () => {
  assert.equal(dateSchema.safeParse("2024-02-29").success, true);
  for (const invalid of ["2025-02-29", "2026-13-01", "2026-09-31", "not-a-date"]) {
    assert.equal(dateSchema.safeParse(invalid).success, false);
  }
});
test("rejects duplicated task IDs and invalid schedule values", () => {
  const task = { id: "task-1", title: "Task", timeSpan: 60, isBig3: false };
  const payload = { ownerId: "user-1", date: "2026-09-16", revision: 0, data: { tasks: [task], todayTime: {} } };
  assert.equal(savePlannerSchema.safeParse(payload).success, true);
  assert.equal(savePlannerSchema.safeParse({ ...payload, data: { ...payload.data, tasks: [task, task] } }).success, false);
  assert.equal(savePlannerSchema.safeParse({ ...payload, data: { ...payload.data, tasks: [{ ...task, scheduledTime: { startHour: 24, startMinute: 0 } }] } }).success, false);
  assert.equal(savePlannerSchema.safeParse({ ...payload, revision: -1 }).success, false);
});
test("registration requires an explicit public setting or a matching allowed email", () => {
  const before = { registration: process.env.AUTH_REGISTRATION, emails: process.env.AUTH_ALLOWED_EMAILS };
  try {
    delete process.env.AUTH_REGISTRATION;
    process.env.AUTH_ALLOWED_EMAILS = " Owner@Example.com ";
    assert.equal(isEmailAllowed("owner@example.com"), true);
    assert.equal(isEmailAllowed("other@example.com"), false);
    process.env.AUTH_REGISTRATION = "open";
    assert.equal(isEmailAllowed("other@example.com"), true);
    assert.equal(isEmailAllowed(undefined), false);
  } finally {
    if (before.registration === undefined) delete process.env.AUTH_REGISTRATION; else process.env.AUTH_REGISTRATION = before.registration;
    if (before.emails === undefined) delete process.env.AUTH_ALLOWED_EMAILS; else process.env.AUTH_ALLOWED_EMAILS = before.emails;
  }
});
