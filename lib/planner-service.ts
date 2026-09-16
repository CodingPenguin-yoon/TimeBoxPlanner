import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { PlannerData } from "@/lib/storage";

export class PlannerConflict extends Error {}

export async function readPlanner(userId: string, date: string) {
  const planner = await prisma.planner.findUnique({
    where: { userId_date: { userId, date } },
    include: { tasks: { orderBy: { position: "asc" } } },
  });
  if (!planner) return { revision: 0, data: null };
  return {
    revision: planner.revision,
    data: {
      tasks: planner.tasks.map((task) => ({
        id: task.id, title: task.title, timeSpan: task.timeSpan, isBig3: task.isBig3,
        scheduledTime: task.scheduledStartHour !== null && task.scheduledStartMinute !== null
          ? { startHour: task.scheduledStartHour, startMinute: task.scheduledStartMinute } : undefined,
      })),
      todayTime: { notes: planner.notes ?? "", reflection: planner.reflection ?? "" },
    },
  };
}

export async function writePlanner(userId: string, date: string, data: PlannerData, revision: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      let planner = await tx.planner.findUnique({ where: { userId_date: { userId, date } } });
      if (!planner) {
        if (revision !== 0) throw new PlannerConflict();
        planner = await tx.planner.create({ data: { userId, date } });
      }
      // Atomic revision check prevents stale tabs/devices from overwriting newer data.
      const changed = await tx.planner.updateMany({
        where: { id: planner.id, userId, revision },
        data: { notes: data.todayTime.notes ?? null, reflection: data.todayTime.reflection ?? null,
          revision: { increment: 1 } },
      });
      if (changed.count !== 1) throw new PlannerConflict();
      const ids = data.tasks.map((task) => task.id);
      // Never allow a supplied task ID to update another planner (even for the same user).
      const foreign = await tx.task.count({ where: { id: { in: ids }, plannerId: { not: planner.id } } });
      if (foreign) throw new PlannerConflict();
      await tx.task.deleteMany({ where: { plannerId: planner.id, id: { notIn: ids } } });
      for (const [position, task] of data.tasks.entries()) {
        const values = {
          title: task.title, timeSpan: task.timeSpan, isBig3: task.isBig3, position,
          scheduledStartHour: task.scheduledTime?.startHour ?? null,
          scheduledStartMinute: task.scheduledTime?.startMinute ?? null,
        };
        await tx.task.upsert({ where: { id: task.id },
          create: { id: task.id, plannerId: planner.id, ...values }, update: values });
      }
      return revision + 1;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      throw new PlannerConflict();
    }
    throw error;
  }
}

export async function clearPlanner(userId: string, date: string, revision: number) {
  // Keep an empty planner and increment its revision to prevent stale clients resurrecting deleted data.
  return writePlanner(userId, date, { tasks: [], todayTime: {} }, revision);
}
