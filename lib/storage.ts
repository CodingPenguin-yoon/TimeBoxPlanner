/** Browser client for the authenticated planner API. */
export interface TimeboxItem {
  id: string;
  title: string;
  timeSpan: number;
  isBig3: boolean;
  completed?: boolean;
  scheduledTime?: { startHour: number; startMinute: number };
}
export interface PlannerData {
  tasks: TimeboxItem[];
  todayTime: { notes?: string; reflection?: string };
}
export interface PlannerSnapshot { ownerId: string; revision: number; data: PlannerData | null }
export class PlannerApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function checked(response: Response) {
  const result = await response.json();
  if (!response.ok) throw new PlannerApiError(result.error ?? "요청에 실패했습니다.", response.status);
  return result;
}
export async function getPlannerDataByDate(date: string, signal?: AbortSignal): Promise<PlannerSnapshot> {
  return checked(await fetch(`/api/planner?date=${encodeURIComponent(date)}`, { cache: "no-store", signal }));
}
export async function savePlannerData(date: string, data: PlannerData, revision: number, ownerId: string): Promise<{ revision: number }> {
  return checked(await fetch("/api/planner", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, data, revision, ownerId }),
  }));
}
export async function deletePlannerData(date: string, revision: number, ownerId: string): Promise<{ revision: number }> {
  return checked(await fetch(`/api/planner?date=${encodeURIComponent(date)}&revision=${revision}&ownerId=${encodeURIComponent(ownerId)}`, { method: "DELETE" }));
}
export function createEmptyPlannerData(): PlannerData {
  return { tasks: [], todayTime: { notes: "", reflection: "" } };
}

export async function movePlannerTask(date: string, taskId: string, revision: number, ownerId: string): Promise<{ revision: number; targetDate: string }> {
  return checked(await fetch("/api/planner/move", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, taskId, revision, ownerId }),
  }));
}
