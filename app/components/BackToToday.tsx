"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isSameDate } from "@/lib/utils";

interface BackToTodayProps {
  currentDate: Date;
}

/**
 * BackToToday 컴포넌트
 * - 현재 표시 중인 날짜가 오늘이 아닐 때만 표시
 * - 클릭 시 루트 경로(/)로 이동하여 오늘 날짜 플래너 표시
 */
export function BackToToday({ currentDate }: BackToTodayProps) {
  const router = useRouter();
  const today = new Date();

  // 오늘이 아니면 표시
  const isNotToday = !isSameDate(currentDate, today);

  if (!isNotToday) {
    return null;
  }

  const handleBackToToday = () => {
    // 쿼리 파라미터 제거하여 루트로 이동 (오늘 날짜 표시)
    router.push("/");
  };

  return (
    <div className="sticky top-4 z-10 flex justify-center">
      <Button
        onClick={handleBackToToday}
        variant="default"
        className="shadow-lg"
      >
        오늘로 돌아가기
      </Button>
    </div>
  );
}
