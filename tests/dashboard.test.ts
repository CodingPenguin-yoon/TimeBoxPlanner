import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardDates } from "../lib/dashboard";
import { movePlannerSchema, plannerDataSchema } from "../lib/planner-validation";

test("dashboard always includes seven calendar dates through today across leap days and year boundaries", () => {
  assert.deepEqual(dashboardDates("2024-03-02"), ["2024-02-25", "2024-02-26", "2024-02-27", "2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]);
  assert.equal(dashboardDates("2026-01-01")[0], "2025-12-26");
});
test("completion and minute schedules validate without breaking previous clients", () => {
  const task = { id: "task", title: "Read", timeSpan: 15, isBig3: false, scheduledTime: { startHour: 0, startMinute: 15 } };
  assert.equal(plannerDataSchema.safeParse({ tasks: [task], todayTime: {} }).success, true);
  assert.equal(plannerDataSchema.safeParse({ tasks: [{ ...task, completed: true }], todayTime: { notes: "memo", reflection: "review" } }).success, true);
  assert.equal(plannerDataSchema.safeParse({ tasks: [{ ...task, completed: "yes" }], todayTime: {} }).success, false);
  assert.equal(movePlannerSchema.safeParse({ ownerId: "a", taskId: "b", date: "9999-12-31", revision: 0 }).success, false);
});
