import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/apiAuth";
import { decryptPin } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// 관리자가 학생의 현재 PIN을 확인할 때 쓰는 엔드포인트.
// pinEncrypted가 없는 학생(이 기능이 생기기 전에 등록됨)은 pin: null로 응답한다 —
// 이 경우 관리자는 "PIN 재설정"으로 새 번호를 한 번 지정해야 그다음부터 확인할 수 있다.
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id }, select: { pinEncrypted: true } });
  if (!student) return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ pin: decryptPin(student.pinEncrypted) });
}
