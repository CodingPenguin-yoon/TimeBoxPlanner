"use client";

import { useEffect, useState } from "react";
import { CalendarWidget } from "./CalendarWidget";
import { BackToToday } from "./BackToToday";
import { TimeTable } from "./TimeTable";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { formatDateToISO } from "@/lib/utils";
import {
  getPlannerDataByDate,
  savePlannerData,
  createEmptyPlannerData,
  type PlannerData,
  type TimeboxItem,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlannerViewProps {
  date: Date;
}

/**
 * PlannerView 컴포넌트
 * - 좌우 2단 레이아웃: 왼쪽(할일 목록), 오른쪽(타임테이블)
 * - 할일에서 빅3 체크박스 선택
 * - 드래그 앤 드롭으로 할일을 타임테이블에 배치
 * - 데이터가 없으면 빈 플래너 표시
 */
export function PlannerView({ date }: PlannerViewProps) {
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);
  const [dragOverTaskIndex, setDragOverTaskIndex] = useState<number | null>(null);

  useEffect(() => {
    // 날짜가 변경될 때마다 API에서 데이터 로드
    const loadData = async () => {
      setIsLoading(true);

      try {
        const dateISO = formatDateToISO(date);
        const data = await getPlannerDataByDate(dateISO);
        // 데이터가 없으면 빈 플래너 데이터 생성
        setPlannerData(data || createEmptyPlannerData());
      } catch (error) {
        console.error("Error loading planner data:", error);
        setPlannerData(createEmptyPlannerData());
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [date]);


  // 데이터 저장 함수 (자동 저장)
  const handleSave = async () => {
    if (!plannerData) return;

    try {
      const dateISO = formatDateToISO(date);
      await savePlannerData(dateISO, plannerData);
    } catch (error) {
      console.error("Error saving planner data:", error);
    }
  };

  // 할일 추가
  const addTask = () => {
    if (!plannerData) return;
    const newTask: TimeboxItem = {
      id: Date.now().toString(),
      title: "",
      timeSpan: 60, // 기본 1시간 (1시간 단위)
      isBig3: false,
    };
    setPlannerData({
      ...plannerData,
      tasks: [...plannerData.tasks, newTask],
    });
    handleSave();
  };

  // 할일 업데이트
  const updateTask = (id: string, field: keyof TimeboxItem, value: string | number | boolean) => {
    if (!plannerData) return;
    const newTasks = plannerData.tasks.map((task) =>
      task.id === id ? { ...task, [field]: value } : task
    );
    setPlannerData({ ...plannerData, tasks: newTasks });
    handleSave();
  };

  // 할일 삭제
  const removeTask = (id: string) => {
    if (!plannerData) return;
    const newTasks = plannerData.tasks.filter((task) => task.id !== id);
    setPlannerData({ ...plannerData, tasks: newTasks });
    handleSave();
  };

  // 타임테이블에 할일 드롭
  const handleTaskDrop = (taskId: string, hour: number, minute: number) => {
    if (!plannerData) return;
    const newTasks = plannerData.tasks.map((task) =>
      task.id === taskId
        ? { ...task, scheduledTime: { startHour: hour, startMinute: minute } }
        : task
    );
    setPlannerData({ ...plannerData, tasks: newTasks });
    handleSave();
  };

  // 타임테이블에서 할일 제거
  const handleTaskRemoveFromTable = (taskId: string) => {
    if (!plannerData) return;
    const newTasks = plannerData.tasks.map((task) =>
      task.id === taskId ? { ...task, scheduledTime: undefined } : task
    );
    setPlannerData({ ...plannerData, tasks: newTasks });
    handleSave();
  };

  // 빅3 체크 (최대 3개)
  const toggleBig3 = (taskId: string) => {
    if (!plannerData) return;
    const task = plannerData.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentBig3Count = plannerData.tasks.filter((t) => t.isBig3).length;
    
    // 이미 빅3로 선택되어 있으면 해제
    if (task.isBig3) {
      updateTask(taskId, "isBig3", false);
      return;
    }

    // 빅3가 3개 미만이면 선택 가능
    if (currentBig3Count < 3) {
      updateTask(taskId, "isBig3", true);
    } else {
      alert("빅3는 최대 3개까지 선택할 수 있습니다.");
    }
  };

  // 할일 목록 내에서 드래그 시작 (순서 변경 및 타임테이블 드래그 모두 지원)
  const handleTaskListDragStart = (e: React.DragEvent, taskId: string, index: number) => {
    setDraggedTask(taskId);
    setDraggedTaskIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.setData("application/task-index", index.toString()); // 순서 변경용 인덱스
  };

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedTask(null);
    setDraggedTaskIndex(null);
    setDragOverTaskIndex(null);
  };

  // 할일 목록 내에서 드롭 (순서 변경)
  const handleTaskListDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    // 타임테이블로 드래그 중이면 무시
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) {
      setDragOverTaskIndex(null);
      return;
    }

    const draggedIndexStr = e.dataTransfer.getData("application/task-index");
    if (!draggedIndexStr || draggedTaskIndex === null || !plannerData) {
      setDragOverTaskIndex(null);
      return;
    }

    const draggedIndex = parseInt(draggedIndexStr);
    if (draggedIndex === dropIndex) {
      setDragOverTaskIndex(null);
      return;
    }

    const newTasks = [...plannerData.tasks];
    const draggedTask = newTasks[draggedIndex];
    
    // 드래그한 할일을 제거하고 새 위치에 삽입
    newTasks.splice(draggedIndex, 1);
    const newDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newTasks.splice(newDropIndex, 0, draggedTask);

    setPlannerData({ ...plannerData, tasks: newTasks });
    handleSave();
    setDragOverTaskIndex(null);
  };

  // 할일 목록 내에서 드래그 오버
  const handleTaskListDragOver = (e: React.DragEvent, index: number) => {
    // 순서 변경 모드일 때만 처리 (draggedTaskIndex가 있으면 할일 목록 내 드래그)
    if (draggedTaskIndex !== null) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTaskIndex(index);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!plannerData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">데이터를 불러올 수 없습니다.</div>
      </div>
    );
  }

  // 빅3로 선택된 할일들
  const big3Tasks = plannerData.tasks.filter((t) => t.isBig3);
  // 타임테이블에 배치되지 않은 할일들
  const unscheduledTasks = plannerData.tasks.filter((t) => !t.scheduledTime);
  // 타임테이블에 배치된 할일들
  const scheduledTasks = plannerData.tasks.filter((t) => t.scheduledTime);

  return (
    <div>
      {/* Back to Today 버튼 */}
      <BackToToday currentDate={date} />

      {/* 헤더 */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold">
            {format(date, "yyyy년 MM월 dd일 (EEE)", { locale: ko })}
          </h1>
          <div className="flex items-center gap-2">
            <CalendarWidget selectedDate={date} />
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 - 좌우 2단 레이아웃, 페이지 전체 스크롤 */}
      <main className="container p-4 gap-4 flex">
        {/* 왼쪽: 할일 목록 - sticky로 고정, 화면 높이에 맞춤 */}
        <div className="flex-1 flex flex-col sticky top-4 self-start max-h-[calc(100vh-5rem)]">
          {/* 빅3 섹션 */}
          <section className="rounded-lg border bg-card p-4 flex-shrink-0">
            <h2 className="mb-3 text-lg font-semibold">△ BIG3</h2>
            <div className="space-y-2">
              {big3Tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">할일 중에서 빅3를 선택하세요.</p>
              ) : (
                big3Tasks.map((task, index) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm">{task.title || "(제목 없음)"}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 할일 목록 - 내부 스크롤 */}
          <section className="rounded-lg border bg-card p-4 flex-1 flex flex-col min-h-0">
            <div className="mb-3 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold">△ TODO</h2>
              <Button onClick={addTask} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                추가
              </Button>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
              {plannerData.tasks.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  할일이 없습니다. 추가 버튼을 눌러 작업을 추가하세요.
                </div>
              ) : (
                plannerData.tasks.map((task, index) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      // 할일 목록 내에서 드래그할 때는 순서 변경 플래그 설정
                      handleTaskListDragStart(e, task.id, index);
                    }}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleTaskListDragOver(e, index)}
                    onDrop={(e) => handleTaskListDrop(e, index)}
                    className={cn(
                      "flex items-center gap-2 rounded-md border p-2 hover:bg-accent/50 cursor-move transition-colors",
                      draggedTask === task.id && draggedTaskIndex !== null && "opacity-50",
                      dragOverTaskIndex === index && draggedTaskIndex !== null && draggedTaskIndex !== index && "border-primary bg-primary/10",
                      task.isBig3 && "border-primary bg-primary/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={task.isBig3}
                      onChange={() => toggleBig3(task.id)}
                      className="h-4 w-4 cursor-pointer"
                      title="빅3 선택"
                    />
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTask(task.id, "title", e.target.value)}
                      placeholder="할일 제목"
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <select
                      value={task.timeSpan}
                      onChange={(e) => updateTask(task.id, "timeSpan", parseInt(e.target.value))}
                      className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm text-center ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[60, 120, 180, 240, 300].map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes / 60}시간
                        </option>
                      ))}
                    </select>
                    {task.scheduledTime && (
                      <span className="text-xs text-muted-foreground bg-primary/20 px-2 py-1 rounded">
                        배치됨
                      </span>
                    )}
                    <Button
                      onClick={() => removeTask(task.id)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* 오른쪽: 타임테이블 */}
        <div className="flex-1">
          <TimeTable
            tasks={scheduledTasks}
            onTaskDrop={handleTaskDrop}
            onTaskRemove={handleTaskRemoveFromTable}
          />
        </div>
      </main>
    </div>
  );
}
