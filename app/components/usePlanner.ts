"use client";
import { useEffect, useRef, useState } from "react";
import { createEmptyPlannerData, getPlannerDataByDate, savePlannerData, movePlannerTask, PlannerApiError, type PlannerData } from "@/lib/storage";

// PlannerView is keyed by user/date: queues and revisions cannot cross between days/accounts.
export function usePlanner(date: string, previewData?: PlannerData) {
  const [plannerData, setPlannerData] = useState<PlannerData | null>(previewData ?? null);
  const [isLoading, setIsLoading] = useState(!previewData);
  const [isSaving, setIsSaving] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const moving = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const revision = useRef(0);
  const ownerId = useRef("");
  const pending = useRef<PlannerData | null>(null);
  const running = useRef(false);
  const failed = useRef(false);

  useEffect(() => {
    if (previewData) return;
    const controller = new AbortController();
    getPlannerDataByDate(date, controller.signal).then((snapshot) => {
      revision.current = snapshot.revision;
      ownerId.current = snapshot.ownerId;
      setPlannerData(snapshot.data ?? createEmptyPlannerData());
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause);
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [date, previewData]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || running.current || moving.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const guard = (event: Event) => {
      const target = event.target;
      const link = target instanceof Element ? target.closest("a") : null;
      if (event.type === "click" && (!link || link.target === "_blank")) return;
      if ((pending.current || running.current || moving.current) && !window.confirm("저장되지 않은 변경이 있습니다. 이 화면을 나갈까요?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    document.addEventListener("submit", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
      document.removeEventListener("submit", guard, true);
    };
  }, []);

  async function flush() {
    if (running.current || failed.current) return;
    running.current = true;
    setIsSaving(true);
    try {
      while (pending.current) {
        const snapshot = pending.current;
        pending.current = null;
        try {
          const result = await savePlannerData(date, snapshot, revision.current, ownerId.current);
          revision.current = result.revision;
        } catch (cause) {
          pending.current ??= snapshot;
          failed.current = true;
          setError(cause instanceof Error ? cause : new Error("저장하지 못했습니다."));
          break;
        }
      }
    } finally {
      running.current = false;
      setIsSaving(false);
    }
  }
  function update(data: PlannerData) {
    if (failed.current || moving.current) return;
    setPlannerData(data);
    if (previewData) return;
    pending.current = data;
    void flush();
  }
  function retry() {
    failed.current = false;
    setError(null);
    void flush();
  }
  async function moveTask(taskId: string): Promise<string | null> {
    if (!plannerData || running.current || pending.current || failed.current || moving.current || previewData) return null;
    moving.current = true;
    setIsMoving(true);
    try {
      const result = await movePlannerTask(date, taskId, revision.current, ownerId.current);
      revision.current = result.revision;
      setPlannerData({ ...plannerData, tasks: plannerData.tasks.filter((task) => task.id !== taskId) });
      return result.targetDate;
    } catch (cause) {
      if (cause instanceof PlannerApiError && cause.status === 422) throw cause;
      // An interrupted response may have committed. Reload before any further save.
      failed.current = true;
      setError(new PlannerApiError(cause instanceof Error ? cause.message : "이동 결과를 확인하지 못했습니다. 최신 기록을 불러와 주세요.", 409));
      return null;
    } finally {
      moving.current = false;
      setIsMoving(false);
    }
  }
  return { plannerData, isLoading, isSaving, isMoving, error, update, retry, moveTask };
}
