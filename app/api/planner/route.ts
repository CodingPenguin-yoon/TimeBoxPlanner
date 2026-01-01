import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { PlannerData, TimeboxItem } from "@/lib/storage";

/**
 * GET /api/planner?date=YYYY-MM-DD
 * 특정 날짜의 플래너 데이터 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    // DB에서 플래너 데이터 조회
    const planner = await prisma.planner.findUnique({
      where: { date },
      include: { tasks: true },
    });

    if (!planner) {
      return NextResponse.json(null);
    }

    // PlannerData 형식으로 변환
    const plannerData: PlannerData = {
      tasks: planner.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        timeSpan: task.timeSpan,
        isBig3: task.isBig3,
        scheduledTime:
          task.scheduledStartHour !== null && task.scheduledStartMinute !== null
            ? {
                startHour: task.scheduledStartHour,
                startMinute: task.scheduledStartMinute,
              }
            : undefined,
      })),
      todayTime: {
        notes: planner.notes || undefined,
        reflection: planner.reflection || undefined,
      },
    };

    return NextResponse.json(plannerData);
  } catch (error) {
    console.error("Error fetching planner data:", error);
    // 에러 상세 정보를 로그에 출력하고 클라이언트에도 전달
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: "Failed to fetch planner data", details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/planner
 * 플래너 데이터 저장/업데이트
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, data }: { date: string; data: PlannerData } = body;

    if (!date || !data) {
      return NextResponse.json(
        { error: "Date and data are required" },
        { status: 400 }
      );
    }

    // Upsert: 플래너가 있으면 업데이트, 없으면 생성
    const planner = await prisma.planner.upsert({
      where: { date },
      update: {
        notes: data.todayTime.notes || null,
        reflection: data.todayTime.reflection || null,
        updatedAt: new Date(),
      },
      create: {
        date,
        notes: data.todayTime.notes || null,
        reflection: data.todayTime.reflection || null,
      },
    });

    // 기존 Task 삭제 후 재생성 (간단한 동기화 방식)
    await prisma.task.deleteMany({
      where: { plannerId: planner.id },
    });

    // 새 Task 생성
    await prisma.task.createMany({
      data: data.tasks.map((task) => ({
        plannerId: planner.id,
        title: task.title,
        timeSpan: task.timeSpan,
        isBig3: task.isBig3,
        scheduledStartHour: task.scheduledTime?.startHour ?? null,
        scheduledStartMinute: task.scheduledTime?.startMinute ?? null,
      })),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving planner data:", error);
    return NextResponse.json(
      { error: "Failed to save planner data" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/planner?date=YYYY-MM-DD
 * 특정 날짜의 플래너 데이터 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    await prisma.planner.delete({
      where: { date },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting planner data:", error);
    return NextResponse.json(
      { error: "Failed to delete planner data" },
      { status: 500 }
    );
  }
}

