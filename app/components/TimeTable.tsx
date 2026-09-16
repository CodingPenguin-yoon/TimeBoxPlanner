"use client";

import { useEffect, useState, type DragEvent } from "react";
import type { TimeboxItem } from "@/lib/storage";
import { Clock3, Check, GripVertical, X } from "lucide-react";
import { useTimelineRange } from "./useTimelineRange";
import { cn } from "@/lib/utils";
import { DAY_MINUTES, PIXELS_PER_MINUTE, layoutTimeline, snapTimelineMinute } from "@/lib/timeline";

const timeLabel = (minute: number) => `${minute >= DAY_MINUTES ? "다음 날 " : ""}${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export function TimeTable({ tasks, draggingTask, onTaskDrop, onTaskRemove, disabled = false }: {
  tasks: TimeboxItem[];
  draggingTask?: TimeboxItem;
  onTaskDrop: (taskId: string, hour: number, minute: number) => void;
  onTaskRemove: (taskId: string) => void;
  disabled?: boolean;
}) {
  const [dropMinute, setDropMinute] = useState<number | null>(null);
  const [localDrag, setLocalDrag] = useState<{ id: string; grabMinutes: number } | null>(null);
  const { range, setRange } = useTimelineRange();
  const [showAll, setShowAll] = useState(false);
  const startMinute = showAll ? 0 : range.startHour * 60;
  const endMinute = showAll ? DAY_MINUTES : range.endHour * 60;
  const outsideCount = tasks.filter((task) => {
    if (!task.scheduledTime) return false;
    const start = task.scheduledTime.startHour * 60 + task.scheduledTime.startMinute;
    return start < range.startHour * 60 || Math.min(start + task.timeSpan, DAY_MINUTES) > range.endHour * 60;
  }).length;
  const entries = layoutTimeline(tasks.filter((task) => {
    if (!task.scheduledTime) return false;
    const start = task.scheduledTime.startHour * 60 + task.scheduledTime.startMinute;
    return start < endMinute && start + task.timeSpan > startMinute;
  }));
  function changeRange(next: typeof range) {
    setRange(next); setShowAll(false); setDropMinute(null); setLocalDrag(null);
  }
  const activeTask = draggingTask ?? tasks.find((task) => task.id === localDrag?.id);
  const previewDuration = activeTask?.timeSpan ?? 30;

  useEffect(() => {
    const clear = () => { setDropMinute(null); setLocalDrag(null); };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => { window.removeEventListener("dragend", clear); window.removeEventListener("drop", clear); };
  }, []);

  function pointerMinute(event: DragEvent<HTMLDivElement>) {
    return snapTimelineMinute(event.clientY - event.currentTarget.getBoundingClientRect().top, startMinute, localDrag?.grabMinutes ?? 0, endMinute);
  }

  return <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
    <div className="border-b p-5 sm:px-6">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-semibold"><Clock3 className="h-4 w-4 text-muted-foreground" />하루 시간표</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{tasks.length}개 배치됨</span></div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">원하는 시간으로 끌어 놓으세요. 15분 단위로 맞춰집니다.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-1 text-muted-foreground">표시 시간</span>
        <select aria-label="시간표 시작 시간" value={range.startHour} onChange={(event) => changeRange({ ...range, startHour: Number(event.target.value) })} className="h-9 rounded-lg border bg-background px-2 tabular-nums">
          {Array.from({ length: range.endHour }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
        </select>
        <span aria-hidden="true" className="text-muted-foreground">–</span>
        <select aria-label="시간표 종료 시간" value={range.endHour} onChange={(event) => changeRange({ ...range, endHour: Number(event.target.value) })} className="h-9 rounded-lg border bg-background px-2 tabular-nums">
          {Array.from({ length: 24 - range.startHour }, (_, index) => range.startHour + index + 1).map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
        </select>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">이 브라우저에서 다른 날짜에도 유지됩니다.</p>
      {(outsideCount > 0 || showAll) && <div role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
        <span>{showAll ? "하루 전체를 보고 있어요" : `범위 밖 일정 ${outsideCount}개 · 일부 또는 전체가 숨겨져 있어요`}</span>
        <button onClick={() => { setShowAll((value) => !value); setDropMinute(null); }} className="font-medium text-primary underline underline-offset-2">{showAll ? "설정한 범위로 돌아가기" : "전체 보기"}</button>
      </div>}
    </div>
    <div className="px-4 pb-6 sm:px-6">
      <div className="flex min-h-12 items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>일정의 높이는 소요 시간에 비례해요</span>

      </div>
      <div className="relative mr-1">
        {Array.from({ length: (endMinute - startMinute) / 60 + 1 }, (_, index) => {
          const minute = startMinute + index * 60;
          return <span key={minute} aria-hidden="true" className="pointer-events-none absolute left-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ top: index * 60 * PIXELS_PER_MINUTE }}>{minute === DAY_MINUTES ? "24:00" : timeLabel(minute)}</span>;
        })}
        <div aria-label="시간표 · 15분 단위 배치" className="relative ml-12 border-l border-border/70"
          style={{ height: (endMinute - startMinute) * PIXELS_PER_MINUTE,
            backgroundImage: "repeating-linear-gradient(to bottom, var(--border) 0px, var(--border) 1px, transparent 1px, transparent 120px), repeating-linear-gradient(to bottom, transparent 0px, transparent 29px, color-mix(in srgb, var(--border) 40%, transparent) 29px, color-mix(in srgb, var(--border) 40%, transparent) 30px)" }}
          onDragOver={(event) => { if (disabled || !activeTask) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropMinute(pointerMinute(event)); }}
          onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropMinute(null); }}
          onDrop={(event) => {
            if (disabled || !activeTask) return;
            event.preventDefault();
            const id = event.dataTransfer.getData("text/plain");
            const minute = pointerMinute(event);
            if (id === activeTask.id) onTaskDrop(id, Math.floor(minute / 60), minute % 60);
            setDropMinute(null); setLocalDrag(null);
          }}>
          {entries.map(({ task, start, end, column, columns }) => {
            const visibleStart = Math.max(start, startMinute);
            const visibleEnd = Math.min(end, endMinute);
            const compact = visibleEnd - visibleStart < 30;
            const clipped = visibleStart > start || visibleEnd < end;
            const label = `${task.title || "제목 없는 할 일"}, ${timeLabel(start)}–${timeLabel(start + task.timeSpan)}, ${task.timeSpan}분${clipped ? ", 표시 범위 밖 부분 숨김" : ""}`;
            return <div key={task.id} data-timeline-task={task.id} title={label} aria-label={label}
              draggable={!disabled}
              onDragStart={(event) => {
                if (disabled) { event.preventDefault(); return; }
                const grabMinutes = visibleStart - start + Math.floor((event.clientY - event.currentTarget.getBoundingClientRect().top) / PIXELS_PER_MINUTE / 15) * 15;
                setLocalDrag({ id: task.id, grabMinutes });
                event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.effectAllowed = "move";
              }}
              className={cn("group absolute box-border overflow-hidden rounded-md border border-primary/20 border-l-[3px] border-l-primary bg-[#eaf0eb] text-foreground shadow-sm transition-colors hover:bg-[#e2ebe4]", !disabled && "cursor-grab active:cursor-grabbing", localDrag?.id === task.id && "opacity-30", task.completed && "border-l-primary/40 bg-muted text-muted-foreground")}
              style={{ top: (visibleStart - startMinute) * PIXELS_PER_MINUTE, height: (visibleEnd - visibleStart) * PIXELS_PER_MINUTE, left: `calc(${column / columns * 100}% + 5px)`, width: `calc(${100 / columns}% - 9px)` }}>
              <div className={cn("flex min-w-0 items-center gap-1.5 pl-2 pr-1", compact ? "h-full" : "pt-1.5")}>
                {task.completed ? <Check className="h-3 w-3 shrink-0" /> : <GripVertical aria-hidden="true" className="hidden h-3 w-3 shrink-0 text-primary/40 sm:block" />}
                <span className={cn("min-w-0 flex-1 truncate text-xs font-medium", task.completed && "line-through")}>{task.title || "(제목 없음)"}</span>
                {compact && columns === 1 && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{timeLabel(start)} · {task.timeSpan}분</span>}
                <button disabled={disabled} draggable={false} onDragStart={(event) => event.stopPropagation()} onClick={() => onTaskRemove(task.id)} aria-label={`${task.title || "할 일"} 시간표에서 제거`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-white/70 hover:text-destructive"><X className="h-3 w-3" /></button>
              </div>
              {!compact && <p className="truncate px-2 pt-0.5 text-[10px] tabular-nums text-muted-foreground sm:pl-[26px]">{timeLabel(start)}–{timeLabel(start + task.timeSpan)} · {task.timeSpan}분</p>}
            </div>;
          })}
          {dropMinute !== null && activeTask && !disabled && <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 z-20 rounded-md border border-dashed border-primary bg-primary/10" style={{ top: (dropMinute - startMinute) * PIXELS_PER_MINUTE, height: Math.min(previewDuration, endMinute - dropMinute) * PIXELS_PER_MINUTE }}>
            <div className="absolute -left-1 -right-1 top-0 border-t-2 border-primary"><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-primary" /></div>
            <span className="absolute -top-6 right-0 rounded bg-primary px-2 py-1 text-[10px] font-medium tabular-nums text-primary-foreground">{timeLabel(dropMinute)}–{timeLabel(dropMinute + previewDuration)}</span>
          </div>}
        </div>
      </div>
    </div>
  </section>;
}
