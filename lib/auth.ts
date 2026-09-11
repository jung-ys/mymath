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

// ---- PIN 복원용 암호화 (관리자가 기존 PIN을 다시 확인할 수 있도록) ----
// pinHash(scrypt)는 단방향이라 원래 숫자를 복원할 수 없다. 그래서 로그인 검증에는
// 계속 pinHash를 쓰되, 별도로 SESSION_SECRET으로 대칭 암호화한 pinEncrypted를 함께
// 저장해서 관리자 화면에서만 복호화해 보여준다(examToken.ts와 같은 AES-256-GCM 패턴).
const PIN_KEY = crypto.createHash("sha256").update(SECRET).digest();

export function encryptPin(pin: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", PIN_KEY, iv);
  const enc = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptPin(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const buf = Buffer.from(token, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", PIN_KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
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
