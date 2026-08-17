import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent } from "@/lib/apiAuth";
import { studentSummary } from "@/lib/studentView";
import { LEVELS, MASTER_LEVEL } from "@/lib/levels";

export async function GET(req: NextRequest) {
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const summary = await studentSummary(student);
  return NextResponse.json({ ...summary, levels: LEVELS, masterLevel: MASTER_LEVEL });
}
