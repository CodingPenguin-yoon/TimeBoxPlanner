"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Leaf, CalendarDays, ArrowRight, NotebookPen, CircleCheck, Clock3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { cn, getTodayISO } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard";
import { PlannerApiError } from "@/lib/storage";

export function Dashboard({ name, previewData }: { name?: string | null; previewData?: DashboardData }) {
  const [data, setData] = useState<DashboardData | null>(previewData ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (previewData) return;
    let controller: AbortController | undefined;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      fetch(`/api/dashboard?date=${getTodayISO()}`, { cache: "no-store", signal }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new PlannerApiError(result.error ?? "대시보드를 불러오지 못했습니다.", response.status);
        if (!signal.aborted) { setData(result); setError(null); }
      }).catch((cause) => { if (!signal.aborted) setError(cause instanceof Error ? cause : new Error("대시보드를 불러오지 못했습니다.")); });
    };
    load();
    const visible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", visible);
    return () => { controller?.abort(); window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", visible); };
  }, [previewData, attempt]);

  const plannerHref = (date: string) => `${previewData ? "/preview" : "/planner"}?date=${date}`;
  if (!data) return <main className="mx-auto max-w-7xl p-8 sm:p-16">
    {error ? <div role="alert"><p>{error.message}</p>{error instanceof PlannerApiError && error.status === 401 ? <Link href="/login" className="mt-4 inline-block underline">다시 로그인</Link> : <button onClick={() => setAttempt((value) => value + 1)} className="mt-4 underline">다시 불러오기</button>}</div> : <p role="status" className="text-muted-foreground">하루의 흐름을 불러오는 중…</p>}
  </main>;
  const tasks = data.today.tasks;
  const completed = tasks.filter((task) => task.completed).length;
  const big3 = tasks.filter((task) => task.isBig3);
  const minutes = tasks.reduce((sum, task) => sum + task.timeSpan, 0);
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const weekTotal = data.days.reduce((sum, day) => sum + day.total, 0);
  const weekDone = data.days.reduce((sum, day) => sum + day.completed, 0);
  const reflections = data.days.filter((day) => day.reflection.trim()).reverse();
  return <main className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-8 sm:pt-12">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground">MY TIME, MY PACE</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name ? `${name}님의 하루, 한눈에.` : "나의 하루, 한눈에."}</h1><p className="mt-2 text-sm text-muted-foreground">{format(parseISO(data.date), "M월 d일 EEEE", { locale: ko })} · 오늘도 중요한 일부터 시작해요.</p></div>
      <Link href={plannerHref(data.date)} className="inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">오늘의 플래너<ArrowUpRight className="h-4 w-4" /></Link>
    </header>
    {error && <div role="alert" className="mb-5 rounded-xl border border-destructive p-3 text-sm">{error.message} 표시된 내용은 마지막으로 불러온 기록입니다. <button onClick={() => setAttempt((value) => value + 1)} className="underline">다시 불러오기</button></div>}
    <div className="mb-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <section className="rounded-2xl border bg-[#eef3e9] p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><Leaf className="h-4 w-4" />오늘 집중할 세 가지</h2><span className="text-xs text-primary">{big3.filter((task) => task.completed).length} / {big3.length} 완료</span></div>
        <div className="space-y-3">{[0, 1, 2].map((index) => {
          const task = big3[index];
          return <Link key={task?.id ?? index} href={plannerHref(data.date)} className="flex min-h-14 items-center gap-3 rounded-xl bg-white/70 px-4 py-3 transition-colors hover:bg-white">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs", task ? "bg-primary text-primary-foreground" : "bg-primary/5 text-muted-foreground")}>{task?.completed ? <Check className="h-4 w-4" /> : index + 1}</span><span className={cn("min-w-0 flex-1 break-words text-sm", (!task || task.completed) && "text-muted-foreground", task?.completed && "line-through")}>{task ? task.title || "제목 없는 할 일" : "오늘의 중요한 일을 골라보세요"}</span>{!task && <PlusIcon />}
          </Link>;
        })}</div>
      </section>
      <section className="rounded-2xl border bg-card p-6 sm:p-7">
        <h2 className="flex items-center gap-2 text-base font-semibold"><CircleCheck className="h-4 w-4 text-muted-foreground" />오늘의 진행 상황</h2>
        <div className="mb-4 mt-6 flex items-end gap-2"><strong className="text-5xl font-semibold tracking-tight">{percent}<span className="text-2xl">%</span></strong><span className="mb-1 text-sm text-muted-foreground">{completed} / {tasks.length}개 완료</span></div>
        <progress aria-label="오늘 완료율" value={completed} max={tasks.length || 1} className="h-2 w-full" />
        <p className="mt-3 text-xs text-muted-foreground">{!tasks.length ? "첫 할 일을 적으며 하루를 시작해 보세요." : completed === tasks.length ? "계획한 일을 모두 마쳤어요. 오늘의 회고를 남겨보세요." : `${tasks.length - completed}개의 할 일이 남았어요. 하나씩, 천천히.`}</p>
        <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Clock3 className="h-4 w-4" />계획한 시간</span><span className="font-medium">{Math.floor(minutes / 60)}시간 {minutes % 60}분</span></div>
      </section>
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
      <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-semibold"><CalendarDays className="h-4 w-4 text-muted-foreground" />최근 일주일</h2><span className="text-xs text-muted-foreground">{weekDone} / {weekTotal}개 완료</span></div>
        <p className="mt-2 text-xs text-muted-foreground">각 날짜에 계획한 일의 현재 완료 상태예요.</p>
        <div className="mt-7 grid grid-cols-7 gap-1.5 sm:gap-3">{data.days.map((day) => {
          const value = day.total ? day.completed / day.total * 100 : 0;
          return <Link key={day.date} href={plannerHref(day.date)} aria-label={`${day.date}, ${day.total}개 중 ${day.completed}개 완료, 플래너 열기`} className={cn("rounded-xl px-1 pb-3 pt-2 text-center hover:bg-muted", day.date === data.date && "bg-muted/70")}>
            <span className="text-[10px] text-muted-foreground sm:text-xs">{day.completed}/{day.total}</span>
            <div className="relative mx-auto mb-3 mt-2 h-24 w-5 overflow-hidden rounded-full bg-muted sm:w-7"><div className="absolute bottom-0 w-full rounded-full bg-primary/75" style={{ height: `${value}%` }} /></div>
            <span className="block text-[11px] font-medium">{format(parseISO(day.date), "EEE", { locale: ko })}</span><span className="text-[10px] text-muted-foreground">{format(parseISO(day.date), "M/d")}</span>
          </Link>;
        })}</div>
        {!weekTotal && <p className="mt-4 text-center text-xs text-muted-foreground">계획과 완료가 쌓이면 나의 일주일이 보여요.</p>}
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7">
        <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold">다시 살펴볼 일</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{data.overdueCount}개</span></div><p className="mb-4 mt-2 text-xs text-muted-foreground">지난 날짜의 미완료 일 · 날짜를 열어 이어서 계획해요.</p>
        {data.overdue.length ? <ul className="divide-y">{data.overdue.map((task) => <li key={task.id}><Link href={plannerHref(task.date)} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm">{task.title || "제목 없는 할 일"}</p><p className="mt-1 text-[11px] text-muted-foreground">{format(parseISO(task.date), "M월 d일")}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul> : <div className="rounded-xl bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">지난 날짜에 남겨둔 일이 없어요.</div>}
        {data.overdueCount > 5 && <p className="mt-3 text-xs text-muted-foreground">전체 {data.overdueCount}개 중 최근 날짜의 5개를 표시하고 있어요.</p>}
      </section>
      <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7 lg:col-span-2">
        <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><NotebookPen className="h-4 w-4 text-muted-foreground" />일주일의 회고</h2><Link href={plannerHref(data.date) + "#day-reflection"} className="text-xs text-primary underline">오늘 기록하기</Link></div>
        {reflections.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{reflections.map((day) => <Link key={day.date} href={plannerHref(day.date) + "#day-reflection"} className="min-w-0 rounded-xl bg-muted/50 p-4 hover:bg-muted"><p className="mb-2 text-xs font-medium text-primary">{format(parseISO(day.date), "M월 d일 EEEE", { locale: ko })}</p><p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{day.reflection}</p></Link>)}</div> : <p className="rounded-xl bg-muted/50 p-6 text-sm leading-6 text-muted-foreground">잘한 일 하나만 적어도 좋아요.<br />하루의 기록이 쌓이면, 나에게 맞는 속도를 찾을 수 있어요.</p>}
      </section>
    </div>
  </main>;
}
function PlusIcon() { return <span aria-hidden="true" className="text-lg text-muted-foreground">+</span>; }
