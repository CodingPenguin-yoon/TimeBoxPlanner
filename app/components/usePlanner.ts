"use client";
import { useEffect, useRef, useState } from "react";
import { createEmptyPlannerData, getPlannerDataByDate, savePlannerData, type PlannerData } from "@/lib/storage";

// PlannerView is keyed by user/date: queues and revisions cannot cross between days/accounts.
export function usePlanner(date: string) {
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const revision = useRef(0);
  const ownerId = useRef("");
  const pending = useRef<PlannerData | null>(null);
  const running = useRef(false);
  const failed = useRef(false);

  useEffect(() => {
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
  }, [date]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current || running.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
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
    if (failed.current) return;
    setPlannerData(data);
    pending.current = data;
    void flush();
  }
  function retry() {
    failed.current = false;
    setError(null);
    void flush();
  }
  return { plannerData, isLoading, isSaving, error, update, retry };
}
