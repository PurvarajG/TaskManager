import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { passwordMatches } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { LoginRateLimiter } from "@/lib/rate-limit";
import { getStoredPassword, setStoredPassword } from "@/lib/store/auth-settings";

const limiter = new LoginRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000, maxKeys: 1_000 });

function requestKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  return createHash("sha256").update(`${forwarded}|${agent}`).digest("hex");
}

export async function POST(request: NextRequest) {
  const password = process.env.APP_PASSWORD;

  const key = requestKey(request);
  const attempt = limiter.consume(key);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
    );
  }

  let currentPassword = "";
  let newPassword = "";
  try {
    const body = (await request.json()) as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof body.currentPassword === "string") currentPassword = body.currentPassword;
    if (typeof body.newPassword === "string") newPassword = body.newPassword;
  } catch {}

  const stored = await getStoredPassword();
  const currentValid = stored
    ? verifyPassword(currentPassword, stored.hash, stored.salt)
    : password
      ? await passwordMatches(currentPassword, password)
      : false;
  if (!currentValid) {
    return NextResponse.json({ error: "Current passcode is incorrect" }, { status: 401 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New passcode must be at least 8 characters" }, { status: 400 });
  }

  await setStoredPassword(newPassword);
  limiter.reset(key);
  return NextResponse.json({ ok: true });
}
