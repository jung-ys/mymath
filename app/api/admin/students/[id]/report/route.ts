import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";
import { computeRangeReport, buildNarrative } from "@/lib/reportStats";
import { todayKST, daysAgoKST } from "@/lib/levels";

type Ctx = { params: Promise<{ id: string }> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  const { id } = await params;

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const to = toParam && DATE_RE.test(toParam) ? toParam : todayKST();
  const from = fromParam && DATE_RE.test(fromParam) ? fromParam : daysAgoKST(29); // 기본 최근 30일

  if (from > to) {
    return NextResponse.json({ error: "시작일이 종료일보다 늦을 수 없습니다." }, { status: 400 });
  }

  try {
    const stats = await computeRangeReport(id, from, to);
    const narrative = buildNarrative(stats);
    return NextResponse.json({ stats, narrative });
  } catch {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  }
}
