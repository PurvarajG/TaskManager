import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, passwordMatches, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { LoginRateLimiter } from "@/lib/rate-limit";
import { getStoredPassword } from "@/lib/store/auth-settings";

const limiter = new LoginRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000, maxKeys: 1_000 });

function requestKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${forwarded}|${agent}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ error: "Login is temporarily unavailable" }, { status: 503 });

  const stored = await getStoredPassword();
  if (!stored && !password) return NextResponse.json({ error: "Login is temporarily unavailable" }, { status: 503 });

  const key = requestKey(request);
  const attempt = limiter.consume(key);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
    );
  }

  let candidate = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") candidate = body.password;
  } catch {}

  const valid = stored ? verifyPassword(candidate, stored.hash, stored.salt) : await passwordMatches(candidate, password!);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  limiter.reset(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
