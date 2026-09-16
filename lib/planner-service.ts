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
        id: task.id, title: task.title, timeSpan: task.timeSpan, isBig3: task.isBig3, completed: task.completed,
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
          title: task.title, timeSpan: task.timeSpan, isBig3: task.isBig3, completed: task.completed, position,
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

export class PlannerMoveError extends Error {}

/** Both days change in one transaction; stale saves on either day then conflict. */
export async function moveTaskToNextDay(userId: string, date: string, taskId: string, revision: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const targetDate = next.toISOString().slice(0, 10);
  try {
    return await prisma.$transaction(async (tx) => {
      const source = await tx.planner.findUnique({ where: { userId_date: { userId, date } } });
      if (!source || source.revision !== revision) throw new PlannerConflict();
      const task = await tx.task.findFirst({ where: { id: taskId, plannerId: source.id } });
      if (!task) throw new PlannerConflict();
      if (task.completed) throw new PlannerMoveError("완료한 일은 다음 날로 넘길 수 없습니다.");
      const target = await tx.planner.upsert({
        where: { userId_date: { userId, date: targetDate } },
        create: { userId, date: targetDate }, update: {},
      });
      const count = await tx.task.count({ where: { plannerId: target.id } });
      if (count >= 500) throw new PlannerMoveError("다음 날의 할 일이 500개여서 이동할 수 없습니다.");
      const last = await tx.task.aggregate({ where: { plannerId: target.id }, _max: { position: true } });
      const changed = await tx.planner.updateMany({ where: { id: source.id, revision }, data: { revision: { increment: 1 } } });
      if (changed.count !== 1) throw new PlannerConflict();
      await tx.planner.update({ where: { id: target.id }, data: { revision: { increment: 1 } } });
      await tx.task.update({ where: { id: taskId }, data: {
        plannerId: target.id, position: (last._max.position ?? -1) + 1,
        isBig3: false, scheduledStartHour: null, scheduledStartMinute: null,
      } });
      return { revision: revision + 1, targetDate };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new PlannerConflict();
    throw error;
  }
}
