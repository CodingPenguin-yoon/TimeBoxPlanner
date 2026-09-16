import type { TimeboxItem } from "./storage";

export const PIXELS_PER_MINUTE = 2;
export const SNAP_MINUTES = 15;
export const DAY_MINUTES = 1440;

export function snapTimelineMinute(offsetY: number, startMinute: number, grabMinutes = 0, endMinute = DAY_MINUTES) {
  const minute = startMinute + offsetY / PIXELS_PER_MINUTE - grabMinutes;
  return Math.max(startMinute, Math.min(endMinute - SNAP_MINUTES, Math.floor(minute / SNAP_MINUTES) * SNAP_MINUTES));
}

/** Connected groups of overlapping intervals share columns; touching edges do not overlap. */
export function layoutTimeline(tasks: TimeboxItem[]) {
  const entries = tasks.filter((task) => task.scheduledTime).map((task) => {
    const start = task.scheduledTime!.startHour * 60 + task.scheduledTime!.startMinute;
    return { task, start, end: Math.min(DAY_MINUTES, start + task.timeSpan), column: 0, columns: 1 };
  }).sort((a, b) => a.start - b.start || b.end - a.end || a.task.id.localeCompare(b.task.id));
  let group: typeof entries = [];
  let groupEnd = -1;
  let columnEnds: number[] = [];
  function finishGroup() { for (const entry of group) entry.columns = columnEnds.length; }
  for (const entry of entries) {
    if (entry.start >= groupEnd) {
      finishGroup(); group = []; columnEnds = []; groupEnd = -1;
    }
    let column = columnEnds.findIndex((end) => end <= entry.start);
    if (column === -1) column = columnEnds.length;
    entry.column = column;
    columnEnds[column] = entry.end;
    group.push(entry);
    groupEnd = Math.max(groupEnd, entry.end);
  }
  finishGroup();
  return entries;
}
