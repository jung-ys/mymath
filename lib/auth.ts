import crypto from "crypto";

// Vercel(서버리스) 환경에서는 서버 메모리에 세션을 보관할 수 없으므로,
// 쿠키 값 자체에 서명을 붙여 위조를 막는 방식(stateless)을 쓴다.
const SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-insecure-secret";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function makeSignedToken(value: string): string {
  return `${value}.${sign(value)}`;
}

function verifySignedToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(value);
  if (sig.length !== expected.length) return null;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? value : null;
  } catch {
    return null;
  }
}

// ---- PIN / 관리자 비밀번호 해시 (scrypt) ----

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  try {
    const hashBuf = Buffer.from(hash, "hex");
    const testBuf = crypto.scryptSync(secret, salt, 64);
    if (hashBuf.length !== testBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, testBuf);
  } catch {
    return false;
  }
}

// ---- 쿠키 ----

export const STUDENT_COOKIE = "sid";
export const ADMIN_COOKIE = "admin_sid";

export const STUDENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8; // 8시간

export function makeAdminToken(): string {
  return makeSignedToken("admin");
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  return verifySignedToken(token) === "admin";
}

export function makeStudentToken(studentId: string): string {
  return makeSignedToken(studentId);
}

export function studentIdFromToken(token: string | undefined | null): string | null {
  return verifySignedToken(token);
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
  } catch {
    return false;
  }
}
