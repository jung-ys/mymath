import { NextResponse } from "next/server";
import { STUDENT_COOKIE, ADMIN_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STUDENT_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
