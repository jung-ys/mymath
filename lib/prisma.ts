import { PrismaClient } from "@prisma/client";

// Next.js 개발 모드에서 hot-reload 시 PrismaClient가 중복 생성되는 것을 방지
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
