import { NextRequest, NextResponse } from "next/server";
import { getAuthedStudent, isAdminRequest } from "@/lib/apiAuth";
import { publicStudent } from "@/lib/studentView";

export async function GET(req: NextRequest) {
  if (isAdminRequest(req)) {
    return NextResponse.json({ authed: true, type: "admin" });
  }
  const student = await getAuthedStudent(req);
  if (!student) return NextResponse.json({ authed: false });
  return NextResponse.json({ authed: true, type: "student", student: publicStudent(student) });
}
