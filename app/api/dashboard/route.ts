import { NextRequest } from "next/server";
import { currentUser } from "@/auth";
import { dateSchema } from "@/lib/planner-validation";
import { json } from "@/lib/planner-http";
import { readDashboard } from "@/lib/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    const date = dateSchema.safeParse(request.nextUrl.searchParams.get("date"));
    if (!date.success || date.data < "0001-01-07") return json({ error: "날짜를 확인해 주세요." }, 400);
    return json(await readDashboard(user.id, date.data));
  } catch (error) {
    console.error("Dashboard read failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "대시보드를 불러오지 못했습니다. 다시 시도해 주세요." }, 500);
  }
}
