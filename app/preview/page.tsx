import { notFound } from "next/navigation";
import { Layers2 } from "lucide-react";
import { Dashboard } from "../components/Dashboard";
import { dashboardDates } from "@/lib/dashboard";
import { formatDateToISO } from "@/lib/utils";
import { PlannerView } from "../components/PlannerView";
import { parseDateFromISO } from "@/lib/utils";
import type { PlannerData } from "@/lib/storage";

const sampleData: PlannerData = {
  tasks: [
    { id: "preview-1", title: "오늘의 목표 정리하기", timeSpan: 60, isBig3: true, scheduledTime: { startHour: 8, startMinute: 0 } },
    { id: "preview-2", title: "가장 중요한 프로젝트에 집중하기", timeSpan: 120, isBig3: true, scheduledTime: { startHour: 9, startMinute: 0 } },
    { id: "preview-3", title: "산책하며 생각 정리하기", timeSpan: 60, isBig3: true, scheduledTime: { startHour: 13, startMinute: 0 } },
    { id: "preview-4", title: "읽고 싶었던 책 읽기", timeSpan: 60, isBig3: false },
    { id: "preview-5", title: "메일과 다음 주 일정 확인", timeSpan: 60, isBig3: false },
  ],
  todayTime: {},
};

export default async function Preview({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { date: dateParam, view } = await searchParams;
  const date = (dateParam && parseDateFromISO(dateParam)) || new Date();
  return <>
    <div className="border-b bg-card/80">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2.5 text-sm font-semibold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Layers2 className="h-4 w-4" /></span>Timebox<span className="hidden font-normal text-muted-foreground sm:inline">Planner</span></div>
        <span className="text-xs text-muted-foreground">로컬 미리보기</span>
      </div>
    </div>
    {view === "dashboard" ? <Dashboard previewData={{
      date: formatDateToISO(date), today: { ...sampleData, tasks: sampleData.tasks.map((task, index) => ({ ...task, completed: index === 0 })) },
      days: dashboardDates(formatDateToISO(date)).map((day, index) => ({ date: day, total: 5, completed: index === 6 ? 1 : index % 4 + 1, plannedMinutes: 240, reflection: index === 5 ? "중요한 일부터 시작하니 하루가 한결 가벼웠다. 내일은 산책 시간을 조금 더 챙겨야지." : "" })),
      overdue: [{ id: "past-task", title: "읽고 싶었던 책 읽기", date: dashboardDates(formatDateToISO(date))[5] }], overdueCount: 1,
    }} /> : <PlannerView key={date.toISOString()} date={formatDateToISO(date)} previewData={sampleData} />}
  </>;
}
