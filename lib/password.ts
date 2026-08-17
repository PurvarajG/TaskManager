import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(plain: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEY_LENGTH).toString("hex");
  return { hash, salt };
}

export function verifyPassword(plain: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(plain, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
