"use client";

import { useState } from "react";
import type { TimeboxItem } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface TimeTableProps {
  tasks: TimeboxItem[];
  onTaskDrop: (taskId: string, hour: number, minute: number) => void;
  onTaskRemove: (taskId: string) => void;
}

/**
 * TimeTable 컴포넌트
 * - 1시간 단위 블록으로 구성된 타임테이블
 * - 할일이 여러 블록에 걸쳐서 표시 가능
 * - 드래그 앤 드롭으로 할일 배치
 */
export function TimeTable({ tasks, onTaskDrop, onTaskRemove }: TimeTableProps) {
  const [dragOver, setDragOver] = useState<{ hour: number; minute: number } | null>(null);

  // 특정 1시간 블록에 걸쳐있는 할일 가져오기 (할일이 이 블록을 차지하는 경우)
  const getTasksAtBlock = (hour: number): TimeboxItem[] => {
    return tasks.filter((task) => {
      if (!task.scheduledTime) return false;
      
      const startHour = task.scheduledTime.startHour;
      const startMinute = task.scheduledTime.startMinute;
      const timeSpanMinutes = task.timeSpan || 60;
      
      // 시작 시간을 분으로 변환
      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = startTotalMinutes + timeSpanMinutes;
      
      // 현재 1시간 블록의 시작과 끝 (분 단위)
      const blockStart = hour * 60;
      const blockEnd = blockStart + 60;
      
      // 할일이 현재 블록과 겹치는지 확인
      return startTotalMinutes < blockEnd && endTotalMinutes > blockStart;
    });
  };

  // 셀의 드롭 핸들러 (타임테이블에서 드래그한 것도 처리)
  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.stopPropagation();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onTaskDrop(taskId, hour, 0); // 1시간 단위이므로 minute는 항상 0
    }
    setDragOver(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (hour: number) => {
    setDragOver({ hour, minute: 0 });
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  // 시간대 생성 (6시 ~ 새벽 2시)
  const timeSlots: number[] = [];
  // 6시 ~ 12시
  for (let h = 6; h <= 12; h++) {
    timeSlots.push(h);
  }
  // 1시 ~ 12시 (PM, 13-24시)
  for (let h = 1; h <= 12; h++) {
    timeSlots.push(h + 12);
  }
  // 1시 ~ 2시 (새벽, 다음날)
  for (let h = 1; h <= 2; h++) {
    timeSlots.push(h);
  }

  const formatHour = (hour: number): string => {
    // 시간대 순서에 맞게 포맷팅 (6시 AM ~ 새벽 2시)
    // AM/PM 형식으로 표시
    if (hour >= 6 && hour <= 11) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    if (hour >= 13 && hour <= 23) return `${hour - 12} PM`;
    if (hour === 24) return "12 AM";
    // 1-2는 다음날 새벽
    if (hour >= 1 && hour <= 2) return `${hour} AM`;
    return `${hour}`;
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-4 text-lg font-semibold">Time Table</h2>
      <div className="space-y-1">
        {timeSlots.map((hour) => {
          const tasksAtBlock = getTasksAtBlock(hour);
          const blockKey = `${hour}`;
          const isDragOverBlock = dragOver?.hour === hour;
          
          return (
            <div
              key={blockKey}
              className={cn(
                "rounded-lg border border-border bg-card p-3 transition-colors",
                isDragOverBlock && "border-primary bg-primary/5 shadow-md"
              )}
              onDrop={(e) => handleDrop(e, hour)}
              onDragOver={handleDragOver}
              onDragEnter={() => handleDragEnter(hour)}
              onDragLeave={handleDragLeave}
            >
              <div className="flex items-start gap-4">
                {/* 시간 라벨 */}
                <div className="w-16 flex-shrink-0 pt-1">
                  <div className="text-sm font-semibold text-foreground">
                    {formatHour(hour)}
                  </div>
                </div>
                
                {/* 할일 영역 - 1시간 단위 블록 (고정 높이) */}
                <div className="flex-1 flex flex-col">
                {tasksAtBlock.map((task) => {
                  if (!task.scheduledTime) return null;
                  
                  const startHour = task.scheduledTime.startHour;
                  const timeSpanMinutes = task.timeSpan || 60;
                  
                  // 이 블록에서 할일이 시작하는지 확인
                  const isStartOfTask = startHour === hour;
                  
                  // 각 블록은 고정 높이 (80px)
                  if (!isStartOfTask) {
                    // 연속 블록 (시각적으로 표시만, 클릭 불가)
                    return (
                      <div
                        key={`${task.id}-${blockKey}`}
                        className="flex items-center justify-between px-4 py-3 bg-primary/10 border border-primary/30 rounded-md text-sm h-[80px] opacity-60"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{task.title || "(제목 없음)"}</div>
                        </div>
                      </div>
                    );
                  }
                  
                  // 시작 블록 (고정 높이, 드래그 가능)
                  return (
                    <div
                      key={`${task.id}-${blockKey}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", task.id);
                        e.dataTransfer.setData("application/task-scheduled", "true"); // 타임테이블에서 드래그 중임을 표시
                      }}
                      className="flex items-center justify-between px-4 py-3 bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-md text-sm h-[80px] transition-colors cursor-move"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{task.title || "(제목 없음)"}</div>
                        {task.timeSpan && task.timeSpan >= 60 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {task.timeSpan / 60}시간
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskRemove(task.id);
                        }}
                        className="ml-3 text-destructive hover:text-destructive/80 text-lg leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                        title="제거"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                
                {/* 빈 영역 - 드롭 가능 표시 */}
                {tasksAtBlock.length === 0 && (
                  <div className="min-h-[80px] flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-md">
                    드래그하여 할일 추가
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
