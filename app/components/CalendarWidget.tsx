"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { formatDateToISO } from "@/lib/utils";
import { format } from "date-fns";

interface CalendarWidgetProps {
  selectedDate: Date;
}

/**
 * CalendarWidget 컴포넌트
 * - 캘린더 아이콘 클릭 시 캘린더 모달/팝오버 표시
 * - 날짜 선택 시 URL 쿼리 파라미터 업데이트 (/?date=YYYY-MM-DD)
 * - URL 변경을 통해 페이지가 해당 날짜의 데이터를 로드
 */
export function CalendarWidget({ selectedDate }: CalendarWidgetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    const dateISO = formatDateToISO(date);

    // URL 업데이트하여 해당 날짜의 플래너 표시
    router.push(`/?date=${dateISO}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[240px] justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(selectedDate, "yyyy년 MM월 dd일")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
