import { NextResponse } from "next/server";
import { STUDENT_COOKIE, ADMIN_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(STUDENT_COOKIE, "", { path: "/", maxAge: 0, secure });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0, secure });
  return res;
}
