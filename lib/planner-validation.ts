import { z } from "zod";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "유효한 날짜가 필요합니다.");

export const plannerDataSchema = z.object({
  tasks: z.array(z.object({
    id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
    title: z.string().max(2000),
    timeSpan: z.number().int().min(1).max(1440),
    isBig3: z.boolean(),
    completed: z.boolean().optional(),
    scheduledTime: z.object({
      startHour: z.number().int().min(0).max(23),
      startMinute: z.number().int().min(0).max(59),
    }).optional(),
  })).max(500).refine((tasks) => new Set(tasks.map((task) => task.id)).size === tasks.length,
    "할 일 ID가 중복되었습니다.").refine((tasks) => tasks.filter((task) => task.isBig3).length <= 3,
    "빅3는 최대 3개입니다."),
  todayTime: z.object({
    notes: z.string().max(20000).optional(),
    reflection: z.string().max(20000).optional(),
  }),
});

export const savePlannerSchema = z.object({
  ownerId: z.string().min(1),
  date: dateSchema,
  revision: z.number().int().nonnegative(),
  data: plannerDataSchema,
});

export const movePlannerSchema = z.object({
  ownerId: z.string().min(1),
  date: dateSchema.refine((date) => date < "9999-12-31", "다음 날로 이동할 수 없는 날짜입니다."),
  taskId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  revision: z.number().int().nonnegative(),
});
