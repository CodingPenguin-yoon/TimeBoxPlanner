import { prisma } from "./db";
import { readPlanner } from "./planner-service";
import { dashboardDates, type DashboardData } from "./dashboard";
import { createEmptyPlannerData } from "./storage";

export async function readDashboard(userId: string, date: string): Promise<DashboardData> {
  const dates = dashboardDates(date);
  const [today, planners, overdue, overdueCount] = await Promise.all([
    readPlanner(userId, date),
    prisma.planner.findMany({ where: { userId, date: { in: dates } }, include: { tasks: true } }),
    prisma.task.findMany({ where: { completed: false, planner: { userId, date: { lt: date } } },
      orderBy: [{ planner: { date: "desc" } }, { position: "asc" }], take: 5, select: { id: true, title: true, planner: { select: { date: true } } } }),
    prisma.task.count({ where: { completed: false, planner: { userId, date: { lt: date } } } }),
  ]);
  return {
    date, today: today.data ?? createEmptyPlannerData(), overdueCount,
    overdue: overdue.map((task) => ({ id: task.id, title: task.title, date: task.planner.date })),
    days: dates.map((day) => {
      const planner = planners.find((item) => item.date === day);
      return { date: day, total: planner?.tasks.length ?? 0,
        completed: planner?.tasks.filter((task) => task.completed).length ?? 0,
        plannedMinutes: planner?.tasks.reduce((sum, task) => sum + task.timeSpan, 0) ?? 0,
        reflection: planner?.reflection ?? "" };
    }),
  };
}
