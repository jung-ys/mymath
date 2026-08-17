import crypto from "crypto";
import type { Problem } from "./levels";

interface TokenExamConfig {
  questionCount: number;
  timeLimitSec: number;
  passScore?: number;
  graceSec?: number;
}

// 서버리스 환경에서는 "시험 시작"과 "시험 제출"이 서로 다른 함수 실행(인스턴스)일 수 있어
// 메모리에 정답을 들고 있을 수 없다. 그래서 문제+정답을 서버 비밀키로 암호화한 토큰을
// 클라이언트에 내려주고, 제출할 때 그 토큰을 그대로 돌려받아 복호화해서 채점한다.
// (토큰은 서버 비밀키 없이는 복호화할 수 없으므로 클라이언트가 정답을 알아낼 수 없다.)

const KEY = crypto
  .createHash("sha256")
  .update(process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-insecure-secret")
  .digest();

export const EXAM_TOKEN_TTL_MS = 30 * 60 * 1000; // 30분

export interface ExamTokenPayload {
  studentId: string;
  kind: "daily" | "level" | "retest";
  level: number;
  problems: Problem[];
  config: TokenExamConfig;
  createdAt: number;
}

export function encryptExamToken(payload: ExamTokenPayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const json = JSON.stringify(payload);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptExamToken(token: string): ExamTokenPayload | null {
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    const payload = JSON.parse(dec.toString("utf8")) as ExamTokenPayload;
    if (Date.now() - payload.createdAt > EXAM_TOKEN_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
