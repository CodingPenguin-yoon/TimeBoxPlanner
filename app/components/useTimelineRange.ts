"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "timebox.timeline-range.v1";
const CHANGE_EVENT = "timebox:timeline-range";
const DEFAULT_RANGE = { startHour: 6, endHour: 23 };
let fallback = "";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}
function snapshot() {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? fallback; }
  catch { return fallback; }
}
function parseRange(value: string): typeof DEFAULT_RANGE {
  try {
    const range = JSON.parse(value);
    if (Number.isInteger(range.startHour) && Number.isInteger(range.endHour) && range.startHour >= 0 && range.endHour <= 24 && range.startHour < range.endHour) return { startHour: range.startHour, endHour: range.endHour };
  } catch { /* Missing or invalid preferences use the default range. */ }
  return DEFAULT_RANGE;
}

export function useTimelineRange() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "");
  const range = parseRange(value);
  function setRange(next: typeof DEFAULT_RANGE) {
    fallback = JSON.stringify(next);
    try { window.localStorage.setItem(STORAGE_KEY, fallback); } catch { /* Keep the preference for this session if storage is unavailable. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return { range, setRange };
}
