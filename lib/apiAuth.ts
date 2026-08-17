import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { STUDENT_COOKIE, ADMIN_COOKIE, studentIdFromToken, isValidAdminToken } from "./auth";

export async function getAuthedStudent(req: NextRequest) {
  const token = req.cookies.get(STUDENT_COOKIE)?.value;
  const studentId = studentIdFromToken(token);
  if (!studentId) return null;
  return prisma.student.findUnique({ where: { id: studentId } });
}

export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token);
}
