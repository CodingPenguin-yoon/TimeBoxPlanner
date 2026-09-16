import { NextRequest } from "next/server";
import { currentUser } from "@/auth";
import { json, sameOrigin, readJsonBody } from "@/lib/planner-http";
import { movePlannerSchema } from "@/lib/planner-validation";
import { moveTaskToNextDay, PlannerConflict, PlannerMoveError } from "@/lib/planner-service";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    if (!sameOrigin(request)) return json({ error: "허용되지 않은 요청입니다." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON 요청이 필요합니다." }, 415);
    let body: unknown;
    try { body = await readJsonBody(request, 4096); }
    catch (error) { return json({ error: "요청 내용을 확인해 주세요." }, error instanceof RangeError ? 413 : 400); }
    const parsed = movePlannerSchema.safeParse(body);
    if (!parsed.success) return json({ error: "날짜와 할 일을 확인해 주세요." }, 400);
    if (parsed.data.ownerId !== user.id) return json({ error: "로그인 계정이 변경되었습니다. 새로고침해 주세요." }, 409);
    return json(await moveTaskToNextDay(user.id, parsed.data.date, parsed.data.taskId, parsed.data.revision));
  } catch (error) {
    if (error instanceof PlannerConflict) return json({ error: "기록이 변경되었습니다. 최신 기록을 다시 불러와 주세요." }, 409);
    if (error instanceof PlannerMoveError) return json({ error: error.message }, 422);
    console.error("Planner move failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "이동 결과를 확인하지 못했습니다. 최신 기록을 다시 불러와 주세요." }, 500);
  }
}
