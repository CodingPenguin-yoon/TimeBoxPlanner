"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Trash2, Leaf, ListTodo, GripVertical, Check, LoaderCircle, Star, ArrowRight, Undo2, LayoutDashboard, NotebookPen } from "lucide-react";
import { usePlanner } from "./usePlanner";
import { PlannerApiError, type TimeboxItem, type PlannerData } from "@/lib/storage";
import { CalendarWidget } from "./CalendarWidget";
import { BackToToday } from "./BackToToday";
import { TimeTable } from "./TimeTable";
import { formatDateToISO, parseDateFromISO, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PlannerView({ date: dateKey, previewData }: { date: string; previewData?: PlannerData }) {
  const date = parseDateFromISO(dateKey)!;
  const { plannerData, isLoading, isSaving, isMoving, error, update, retry, moveTask } = usePlanner(formatDateToISO(date), previewData);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ task: TimeboxItem; index: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [movedDate, setMovedDate] = useState<string | null>(null);
  const blocked = Boolean(error) || isMoving;
  const basePath = previewData ? "/preview" : "/planner";

  function updateTask(id: string, patch: Partial<TimeboxItem>) {
    if (!plannerData || blocked) return;
    update({ ...plannerData, tasks: plannerData.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) });
  }
  function addTask() {
    if (!plannerData || plannerData.tasks.length >= 500) return;
    update({ ...plannerData, tasks: [...plannerData.tasks, { id: crypto.randomUUID(), title: "", timeSpan: 30, isBig3: false, completed: false }] });
  }
  function removeTask(id: string) {
    if (!plannerData) return;
    const index = plannerData.tasks.findIndex((task) => task.id === id);
    if (index < 0) return;
    setDeleted({ task: plannerData.tasks[index], index });
    update({ ...plannerData, tasks: plannerData.tasks.filter((task) => task.id !== id) });
  }
  function undoDelete() {
    if (!plannerData || !deleted || blocked || plannerData.tasks.length >= 500) return;
    const tasks = [...plannerData.tasks];
    const canBeBig3 = tasks.filter((task) => task.isBig3).length < 3;
    tasks.splice(Math.min(deleted.index, tasks.length), 0, { ...deleted.task, isBig3: deleted.task.isBig3 && canBeBig3 });
    update({ ...plannerData, tasks });
    setDeleted(null);
  }
  function toggleBig3(task: TimeboxItem) {
    if (!plannerData) return;
    if (!task.isBig3 && plannerData.tasks.filter((item) => item.isBig3).length >= 3) {
      setNotice("중요한 일은 최대 3개까지 선택할 수 있어요."); return;
    }
    updateTask(task.id, { isBig3: !task.isBig3 });
  }
  async function move(id: string) {
    setNotice(""); setMovedDate(null);
    try {
      const target = await moveTask(id);
      if (target) { setNotice(`${target}로 옮겼어요. 시간과 중요 표시는 새로 정해 주세요.`); setMovedDate(target); }
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "이동하지 못했습니다."); }
  }
  function reorder(taskId: string, targetId: string) {
    if (!plannerData || blocked || taskId === targetId) return;
    const from = plannerData.tasks.findIndex((task) => task.id === taskId);
    const to = plannerData.tasks.findIndex((task) => task.id === targetId);
    if (from < 0 || to < 0) return;
    const tasks = [...plannerData.tasks];
    const [task] = tasks.splice(from, 1);
    tasks.splice(to, 0, task);
    update({ ...plannerData, tasks });
  }

  if (isLoading) return <div role="status" className="p-16 text-center text-muted-foreground">하루를 불러오는 중…</div>;
  if (!plannerData) return <div className="p-16 text-center">
    <p role="alert">{error?.message ?? "데이터를 불러올 수 없습니다."}</p>
    <button className="mt-4 underline" onClick={() => window.location.reload()}>다시 불러오기</button>
    {error instanceof PlannerApiError && error.status === 401 && <a href="/login" className="ml-4 underline">다시 로그인</a>}
  </div>;

  const big3Tasks = plannerData.tasks.filter((task) => task.isBig3);
  const completed = plannerData.tasks.filter((task) => task.completed).length;
  return <div>
    <header className="mx-auto max-w-7xl px-4 pb-7 pt-8 sm:px-8 sm:pt-12">
      <div className="mb-6" inert={isSaving || blocked}>
        <Link href={previewData ? "/preview?view=dashboard" : "/"} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><LayoutDashboard className="h-3.5 w-3.5" />홈 대시보드</Link>
      </div>
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground">DAILY PLANNER</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{format(date, "M월 d일 EEEE", { locale: ko })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">작은 완료를 쌓으며, 나만의 속도로.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span role="status" className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", error && "text-destructive")}>
            {isSaving || isMoving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : !error && <Check className="h-3.5 w-3.5" />}
            {previewData ? "미리보기 · 저장 안 됨" : error ? "저장 확인 필요" : isMoving ? "옮기는 중…" : isSaving ? "저장 중…" : "저장됨"}
          </span>
          <div inert={isSaving || blocked} className="flex items-center gap-2">
            <BackToToday currentDate={date} basePath={basePath} />
            <CalendarWidget selectedDate={date} basePath={basePath} />
          </div>
        </div>
      </div>
    </header>
    {error && <div role="alert" className="mx-auto mb-5 max-w-7xl rounded-xl border border-destructive p-4 text-sm">
      <p>{error.message} 입력한 내용은 이 화면에 남아 있습니다.</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {!(error instanceof PlannerApiError && [401, 409].includes(error.status)) && <button onClick={retry} className="underline">저장 재시도</button>}
        {error instanceof PlannerApiError && error.status === 401 && <><a href="/login" target="_blank" rel="noreferrer" className="underline">새 탭에서 로그인</a><button onClick={retry} className="underline">로그인 후 저장 재시도</button></>}
        <button onClick={() => { if (window.confirm("저장되지 않은 변경을 버리고 다시 불러올까요?")) window.location.reload(); }} className="underline">최신 기록 다시 불러오기</button>
      </div>
    </div>}
    <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-8">
      {notice && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted p-3 text-sm">{notice}{movedDate && <Link href={`/planner?date=${movedDate}`} className="underline">이동한 날짜 열기</Link>}<button onClick={() => { setNotice(""); setMovedDate(null); }} aria-label="안내 닫기" className="ml-auto px-2">×</button></div>}
      {deleted && <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <span className="min-w-0 flex-1 truncate">‘{deleted.task.title || "할 일"}’ 삭제됨</span>
        <button onClick={undoDelete} disabled={blocked || plannerData.tasks.length >= 500} className="flex items-center gap-1 text-primary underline disabled:opacity-40"><Undo2 className="h-4 w-4" />되돌리기</button>
        <button onClick={() => setDeleted(null)} aria-label="삭제 안내 닫기" className="px-2">×</button>
      </div>}
      <fieldset disabled={blocked} className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <legend className="sr-only">하루 계획과 회고</legend>
        <div className="flex min-w-0 flex-col gap-5">
          <section className="rounded-2xl border bg-[#eef3e9] p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><Leaf className="h-4 w-4 text-primary" />오늘의 중요한 일</h2><span className="text-xs text-primary">{big3Tasks.length} / 3</span></div>
            <p className="mb-5 text-xs leading-5 text-muted-foreground">별을 눌러 오늘 집중할 세 가지를 골라보세요.</p>
            <div className="space-y-2.5">{[0, 1, 2].map((index) => {
              const task = big3Tasks[index];
              return <div key={task?.id ?? index} className="flex min-h-12 items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5">
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs", task ? "bg-primary text-primary-foreground" : "bg-primary/5 text-muted-foreground")}>{task?.completed ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
                <span className={cn("min-w-0 break-words text-sm", !task && "text-muted-foreground", task?.completed && "text-muted-foreground line-through")}>{task ? task.title || "제목을 입력해 주세요" : "중요한 일을 선택해 주세요"}</span>
              </div>;
            })}</div>
          </section>
          <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><ListTodo className="h-4 w-4 text-muted-foreground" />할 일 <span className="text-xs font-normal text-muted-foreground">{completed} / {plannerData.tasks.length} 완료</span></h2><Button onClick={addTask} disabled={plannerData.tasks.length >= 500} variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />추가</Button></div>
            <progress aria-label="할 일 완료율" value={completed} max={plannerData.tasks.length || 1} className="mb-3 h-1.5 w-full" />
            <p className="mb-4 text-xs leading-5 text-muted-foreground">체크는 완료, 별은 중요한 일. 시간을 선택하거나 시간표로 끌어 놓으세요.</p>
            <div className="space-y-3">
              {!plannerData.tasks.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">아직 비어 있는 하루예요.<br />추가 버튼으로 첫 할 일을 적어보세요.</div>}
              {plannerData.tasks.map((task) => <div key={task.id}
                onDragOver={(event) => { if (draggedTask) event.preventDefault(); }}
                onDrop={(event) => { if (!draggedTask) return; event.preventDefault(); reorder(draggedTask, task.id); setDraggedTask(null); }}
                className={cn("rounded-xl border bg-muted/30 p-3", task.isBig3 ? "border-primary/25" : "border-transparent", draggedTask === task.id && "opacity-50")}>
                <div className="flex items-center gap-2">
                  <span draggable={!blocked} onDragStart={(event) => { setDraggedTask(task.id); event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDraggedTask(null)} title="끌어서 순서 변경 또는 시간표 배치" className="hidden cursor-grab sm:block"><GripVertical className="h-4 w-4 text-muted-foreground/50" /></span>
                  <input type="checkbox" checked={task.completed ?? false} onChange={(event) => updateTask(task.id, { completed: event.target.checked })} aria-label={`${task.title || "할 일"} 완료`} className="h-5 w-5 shrink-0 cursor-pointer" />
                  <input type="text" value={task.title} maxLength={2000} onChange={(event) => updateTask(task.id, { title: event.target.value })} aria-label="할 일 제목" placeholder="어떤 일을 할까요?" className={cn("min-w-0 flex-1 rounded-md bg-transparent px-1 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring", task.completed && "text-muted-foreground line-through")} />
                  <button onClick={() => toggleBig3(task)} aria-label={`${task.title || "할 일"} 중요한 일로 선택`} aria-pressed={task.isBig3} className="rounded-lg p-2 text-primary hover:bg-primary/10"><Star className={cn("h-4 w-4", task.isBig3 && "fill-current")} /></button>
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
                  <label className="text-[11px] text-muted-foreground">소요 시간<select value={task.timeSpan} onChange={(event) => updateTask(task.id, { timeSpan: Number(event.target.value) })} className="mt-1 block h-9 rounded-lg border bg-card px-2 text-xs text-foreground">{[...new Set([15, 30, 45, 60, 90, 120, 180, 240, 300, task.timeSpan])].sort((a, b) => a - b).map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}`}</option>)}</select></label>
                  <label className="text-[11px] text-muted-foreground">시작 시간<select aria-label={`${task.title || "할 일"} 시작 시간`} value={task.scheduledTime ? task.scheduledTime.startHour * 60 + task.scheduledTime.startMinute : ""} onChange={(event) => { const value = event.target.value; updateTask(task.id, { scheduledTime: value === "" ? undefined : { startHour: Math.floor(Number(value) / 60), startMinute: Number(value) % 60 } }); }} className="mt-1 block h-9 rounded-lg border bg-card px-2 text-xs text-foreground"><option value="">미배치</option>{[...new Set([...Array.from({ length: 96 }, (_, i) => i * 15), ...(task.scheduledTime ? [task.scheduledTime.startHour * 60 + task.scheduledTime.startMinute] : [])])].sort((a, b) => a - b).map((minute) => <option key={minute} value={minute}>{String(Math.floor(minute / 60)).padStart(2, "0")}:{String(minute % 60).padStart(2, "0")}</option>)}</select></label>
                  <div className="ml-auto flex items-center gap-1">
                    {!task.completed && <button disabled={isSaving || isMoving || !!previewData} onClick={() => void move(task.id)} title={previewData ? "실제 플래너에서 사용할 수 있어요" : "다음 날로 옮기기 (시간·중요 표시 해제)"} aria-label={`${task.title || "할 일"} 다음 날로 넘기기`} className="flex h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">다음 날<ArrowRight className="h-3.5 w-3.5" /></button>}
                    <button onClick={() => removeTask(task.id)} aria-label={`${task.title || "할 일"} 삭제`} className="rounded-lg p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>)}
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><NotebookPen className="h-4 w-4 text-muted-foreground" />하루의 기록</h2>
            <label className="block text-sm font-medium" htmlFor="day-notes">메모</label>
            <textarea id="day-notes" value={plannerData.todayTime.notes ?? ""} maxLength={20000} onChange={(event) => update({ ...plannerData, todayTime: { ...plannerData.todayTime, notes: event.target.value } })} placeholder="떠오른 생각, 잊지 말아야 할 일…" rows={3} className="mb-5 mt-2 w-full resize-y rounded-xl border bg-background/60 p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
            <label className="block text-sm font-medium" htmlFor="day-reflection">오늘의 회고</label>
            <p className="mt-1 text-xs text-muted-foreground">잘한 일 한 가지, 내일 바꿔보고 싶은 한 가지.</p>
            <textarea id="day-reflection" value={plannerData.todayTime.reflection ?? ""} maxLength={20000} onChange={(event) => update({ ...plannerData, todayTime: { ...plannerData.todayTime, reflection: event.target.value } })} placeholder="오늘 나의 하루는 어땠나요?" rows={4} className="mt-2 w-full resize-y rounded-xl border bg-background/60 p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
            <p className="mt-2 text-xs text-muted-foreground">메모와 회고는 자동으로 저장됩니다.</p>
          </section>
        </div>
        <TimeTable draggingTask={plannerData.tasks.find((task) => task.id === draggedTask)} tasks={plannerData.tasks.filter((task) => task.scheduledTime)} disabled={blocked} onTaskDrop={(id, startHour, startMinute) => updateTask(id, { scheduledTime: { startHour, startMinute } })} onTaskRemove={(id) => updateTask(id, { scheduledTime: undefined })} />
      </fieldset>
    </main>
  </div>;
}
