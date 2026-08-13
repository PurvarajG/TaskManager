export const SESSION_COOKIE = "dayplan_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function createSessionToken(secret: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ v: 1, exp: now + SESSION_MAX_AGE_SECONDS })));
  return `${payload}.${bytesToBase64Url(await hmac(payload, secret))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!token || !secret) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const supplied = base64UrlToBytes(signature);
  const decoded = base64UrlToBytes(payload);
  if (!supplied || !decoded || !equalBytes(supplied, await hmac(payload, secret))) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(decoded)) as { v?: number; exp?: number };
    return data.v === 1 && typeof data.exp === "number" && data.exp >= now;
  } catch {
    return false;
  }
}

export async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return equalBytes(new Uint8Array(candidateHash), new Uint8Array(expectedHash));
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}
