import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

test("the desktop build contains no session or passcode entry points", () => {
  for (const path of [
    "proxy.ts",
    "app/login/page.tsx",
    "app/api/auth/login/route.ts",
    "app/api/auth/logout/route.ts",
    "app/api/auth/password/route.ts",
    "components/LoginForm.tsx",
    "components/LogoutButton.tsx",
    "components/settings/PasscodeForm.tsx",
    "lib/auth.ts",
    "lib/password.ts",
    "lib/rate-limit.ts",
    "lib/store/auth-settings.ts",
    "tests/rate-limit.test.ts",
  ]) {
    assert.equal(existsSync(resolve(root, path)), false, `${path} should not exist in the desktop app`);
  }
});

test("fresh desktop databases do not create passcode state", () => {
  assert.doesNotMatch(source("lib/schema.sql"), /auth_settings/i);
  assert.doesNotMatch(source("lib/migrate.ts"), /auth_settings|AUTH_SETTINGS_ID/i);
  assert.doesNotMatch(source("lib/types.ts"), /AUTH_SETTINGS_ID/i);
});

test("the desktop settings and sidebar do not expose auth controls", () => {
  assert.doesNotMatch(source("app/settings/page.tsx"), /PasscodeForm|Passcode/);
  assert.doesNotMatch(source("components/Sidebar.tsx"), /LogoutButton/);
});

test("desktop startup has no obsolete login configuration or proxy claim", () => {
  assert.doesNotMatch(source("electron/main.js"), /\bSESSION_SECRET\b|(?<!ICLOUD_)\bAPP_PASSWORD\b/);
  assert.doesNotMatch(source("package.json"), /\bSESSION_SECRET\b|(?<!ICLOUD_)\bAPP_PASSWORD\b/);
  assert.doesNotMatch(source("app/api/external-events/route.ts"), /proxy\.ts|session gate/i);
});
