import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutTimeline, snapTimelineMinute, PIXELS_PER_MINUTE } from "../lib/timeline";
const task = (id: string, startMinute: number, timeSpan: number) => ({ id, title: id, timeSpan, isBig3: false, scheduledTime: { startHour: Math.floor(startMinute / 60), startMinute: startMinute % 60 } });

test("timeline uses actual minute offsets and duration; 15 minutes is one quarter of an hour", () => {
  const entries = layoutTimeline([task("short", 735, 15), task("long", 780, 60)]);
  assert.equal((entries[0].end - entries[0].start) * PIXELS_PER_MINUTE, 30);
  assert.equal((entries[1].end - entries[1].start) * PIXELS_PER_MINUTE, 120);
  assert.equal(entries[0].start, 735);
});
test("overlapping tasks receive separate columns while adjacent tasks share a column", () => {
  const entries = layoutTimeline([task("a", 540, 120), task("b", 555, 15), task("c", 570, 30), task("d", 660, 15)]);
  assert.deepEqual(entries.map(({ column, columns }) => [column, columns]), [[0, 2], [1, 2], [1, 2], [0, 1]]);
});
test("drop targets snap to quarters, preserve the grab offset, and stay within the day", () => {
  assert.equal(snapTimelineMinute(59, 360), 375);
  assert.equal(snapTimelineMinute(120, 360, 30), 390);
  assert.equal(snapTimelineMinute(-100, 360), 360);
  assert.equal(snapTimelineMinute(5000, 360), 1425);
  assert.equal(snapTimelineMinute(5000, 600, 0, 780), 765);
  assert.equal(snapTimelineMinute(-10, 600, 0, 780), 600);
  const entry = layoutTimeline([task("late", 1425, 60)])[0];
  assert.equal(entry.end, 1440);
});
