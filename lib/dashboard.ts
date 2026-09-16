import type { PlannerData } from "./storage";

export interface DashboardDay {
  date: string;
  total: number;
  completed: number;
  plannedMinutes: number;
  reflection: string;
}
export interface DashboardData {
  date: string;
  today: PlannerData;
  days: DashboardDay[];
  overdue: { id: string; title: string; date: string }[];
  overdueCount: number;
}

/** Calendar arithmetic in UTC keeps date-only ranges independent of server timezone/DST. */
export function dashboardDates(date: string): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 6 + index);
    return day.toISOString().slice(0, 10);
  });
}
