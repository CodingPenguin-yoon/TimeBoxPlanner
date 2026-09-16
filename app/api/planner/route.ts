import { NextRequest } from "next/server";
import { json, sameOrigin } from "@/lib/planner-http";
import { currentUser } from "@/auth";
import { dateSchema, savePlannerSchema } from "@/lib/planner-validation";
import { clearPlanner, PlannerConflict, readPlanner, writePlanner } from "@/lib/planner-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1024 * 1024;
function failure(error: unknown) {
  if (error instanceof PlannerConflict) return json({ error: "다른 곳에서 기록이 변경되었습니다. 새로고침 후 다시 시도해 주세요." }, 409);
  console.error("Planner request failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "요청을 처리하지 못했습니다. 다시 시도해 주세요." }, 500);
}

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    const date = dateSchema.safeParse(request.nextUrl.searchParams.get("date"));
    if (!date.success) return json({ error: "날짜 형식이 잘못되었습니다." }, 400);
    return json({ ...await readPlanner(user.id, date.data), ownerId: user.id });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    if (!sameOrigin(request)) return json({ error: "허용되지 않은 요청입니다." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON 요청이 필요합니다." }, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "요청 본문이 필요합니다." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return json({ error: "요청이 너무 큽니다." }, 413); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return json({ error: "JSON 형식이 잘못되었습니다." }, 400); }
    const parsed = savePlannerSchema.safeParse(body);
    if (!parsed.success) return json({ error: "플래너 입력값을 확인해 주세요." }, 400);
    if (parsed.data.ownerId !== user.id) return json({ error: "로그인 계정이 변경되었습니다. 새로고침해 주세요." }, 409);
    const { date, data, revision } = parsed.data;
    return json({ revision: await writePlanner(user.id, date, data, revision) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return json({ error: "로그인이 필요합니다." }, 401);
    if (!sameOrigin(request)) return json({ error: "허용되지 않은 요청입니다." }, 403);
    const date = dateSchema.safeParse(request.nextUrl.searchParams.get("date"));
    if (request.nextUrl.searchParams.get("ownerId") !== user.id) return json({ error: "로그인 계정이 변경되었습니다. 새로고침해 주세요." }, 409);
    const rawRevision = request.nextUrl.searchParams.get("revision");
    const revision = Number(rawRevision);
    if (!date.success || rawRevision === null || !/^\d+$/.test(rawRevision) || !Number.isSafeInteger(revision)) return json({ error: "날짜와 버전을 확인해 주세요." }, 400);
    return json({ revision: await clearPlanner(user.id, date.data, revision) });
  } catch (error) { return failure(error); }
}
