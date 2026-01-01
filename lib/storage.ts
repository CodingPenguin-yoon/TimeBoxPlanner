/**
 * API를 통한 플래너 데이터 저장/조회
 * Prisma + SQLite DB 사용
 */

/**
 * 타임박스 플래너 데이터 타입
 */
export interface TimeboxItem {
  id: string;
  title: string;
  timeSpan: number; // 소요 시간 (분 단위, 예: 30 = 30분)
  isBig3: boolean; // 빅3 선택 여부
  scheduledTime?: {
    // 타임테이블에 배치된 시간 정보
    startHour: number; // 시작 시간 (0-23)
    startMinute: number; // 시작 분 (0, 30)
  };
}

export interface PlannerData {
  tasks: TimeboxItem[]; // 할일 목록
  todayTime: {
    notes?: string; // 시간 관리 메모
    reflection?: string; // 반성/회고
  };
}

/**
 * 특정 날짜의 플래너 데이터 가져오기 (API 호출)
 */
export async function getPlannerDataByDate(date: string): Promise<PlannerData | null> {
  try {
    const response = await fetch(`/api/planner?date=${encodeURIComponent(date)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch planner data");
    }
    const data = await response.json();
    return data; // null이거나 PlannerData
  } catch (error) {
    console.error("Error fetching planner data:", error);
    return null;
  }
}

/**
 * 특정 날짜의 플래너 데이터 저장 (API 호출)
 */
export async function savePlannerData(date: string, data: PlannerData): Promise<void> {
  try {
    const response = await fetch("/api/planner", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date, data }),
    });
    if (!response.ok) {
      throw new Error("Failed to save planner data");
    }
  } catch (error) {
    console.error("Error saving planner data:", error);
    throw error;
  }
}

/**
 * 특정 날짜의 플래너 데이터 삭제 (API 호출)
 */
export async function deletePlannerData(date: string): Promise<void> {
  try {
    const response = await fetch(`/api/planner?date=${encodeURIComponent(date)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete planner data");
    }
  } catch (error) {
    console.error("Error deleting planner data:", error);
    throw error;
  }
}

/**
 * 빈 플래너 데이터 생성
 */
export function createEmptyPlannerData(): PlannerData {
  return {
    tasks: [],
    todayTime: {
      notes: "",
      reflection: "",
    },
  };
}
