import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client 인스턴스
 * 개발 환경에서는 hot reload 시 여러 인스턴스가 생성되는 것을 방지하기 위해 global 객체 사용
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
