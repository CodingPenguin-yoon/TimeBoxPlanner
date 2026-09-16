"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTodayISO } from "@/lib/utils";

export function TodayRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace(`/planner?date=${getTodayISO()}`); }, [router]);
  return <p role="status" className="p-16 text-center text-muted-foreground">오늘의 플래너를 여는 중…</p>;
}
