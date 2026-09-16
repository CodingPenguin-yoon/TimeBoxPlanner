import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    // A reachable DB can still deny access to the application's schema/tables.
    await Promise.all([
      prisma.user.findFirst({ select: { id: true } }),
      prisma.account.findFirst({ select: { id: true } }),
      prisma.session.findFirst({ select: { id: true } }),
      prisma.planner.findFirst({ select: { id: true } }),
      prisma.task.findFirst({ select: { id: true } }),
    ]);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
