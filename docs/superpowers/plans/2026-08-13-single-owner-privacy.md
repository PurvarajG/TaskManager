# Single-Owner Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the owner password before any Task Manager page or API can access the production application or Neon data.

**Architecture:** A small Web Crypto session module signs expiring tokens with HMAC-SHA256 and verifies them in both Next.js Proxy and route handlers. A root `proxy.ts` rejects anonymous API traffic and redirects anonymous page traffic to `/login`; focused auth route handlers issue and clear the HTTP-only cookie. A client login form and logout control provide the owner-facing flow.

**Tech Stack:** Next.js 16.3 App Router and Proxy, React 19, TypeScript, Web Crypto API, Node test runner via `tsx`, Vercel environment variables.

## Global Constraints

- One owner, one password, and no registration, recovery, roles, or per-user ownership.
- `APP_PASSWORD` and `SESSION_SECRET` must never be committed or returned to the browser.
- Missing configuration fails closed.
- All pages and every `/api/*` route are protected except the login surface and required static assets.
- Sessions use a 30-day `Secure`, `HttpOnly`, `SameSite=Lax` cookie in production.
- Existing Neon data and schema remain unchanged.

## File Structure

- `lib/auth.ts`: environment validation, timing-safe password comparison, HMAC session creation/verification, cookie constants, and safe return-path validation.
- `lib/rate-limit.ts`: bounded in-memory login attempt limiter.
- `proxy.ts`: early page redirect and API 401 enforcement.
- `app/api/auth/login/route.ts`: credential verification, throttling, and session-cookie issue.
- `app/api/auth/logout/route.ts`: session-cookie expiry.
- `app/login/page.tsx`: public login route.
- `components/LoginForm.tsx`: interactive password form.
- `components/LogoutButton.tsx`: owner logout action.
- `components/Sidebar.tsx`: desktop/mobile logout placement.
- `app/globals.css`: login styles using existing tokens.
- `tests/auth.test.ts`, `tests/rate-limit.test.ts`, `tests/proxy.test.ts`: unit coverage for the privacy boundary.
- `package.json`: `test` script and `tsx` development dependency.
- `.env.example`: production variable documentation.

---

### Task 1: Session and Login-Limiter Primitives

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/rate-limit.ts`
- Create: `tests/auth.test.ts`
- Create: `tests/rate-limit.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `SESSION_COOKIE`, `SESSION_MAX_AGE_SECONDS`, `createSessionToken(secret, now?)`, `verifySessionToken(token, secret, now?)`, `passwordMatches(candidate, expected)`, `safeReturnPath(value)`, and `LoginRateLimiter.consume(key, now?)`.

- [ ] **Step 1: Add the test runner**

Run `npm install --save-dev tsx` and add `"test": "tsx --test tests/**/*.test.ts"` to `scripts`.

- [ ] **Step 2: Write failing auth tests**

Cover valid signing/verification, tampering, expiry, correct/incorrect password checks, and rejection of absolute, protocol-relative, login-loop, and malformed return paths.

- [ ] **Step 3: Verify auth tests fail**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL because `lib/auth.ts` does not exist.

- [ ] **Step 4: Implement auth primitives**

Use Web Crypto HMAC-SHA256 with a payload `{ v: 1, exp: number }`, base64url encoding, timing-safe byte comparison, a 30-day expiry, and `safeReturnPath` restricted to strings beginning with exactly one `/` and excluding `/login`.

- [ ] **Step 5: Write and fail limiter tests**

Cover five allowed attempts per 15 minutes, HTTP retry timing on the sixth attempt, reset after the window, success reset, and eviction when the key cap is exceeded.

- [ ] **Step 6: Implement the bounded limiter**

Use a `Map<string, { count: number; resetAt: number }>` capped at 1,000 keys; prune expired entries and evict the oldest entry before adding past the cap.

- [ ] **Step 7: Run primitive tests**

Run: `npm test -- tests/auth.test.ts tests/rate-limit.test.ts`
Expected: all tests pass.

### Task 2: Server-Side Privacy Boundary

**Files:**
- Create: `proxy.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `tests/proxy.test.ts`

**Interfaces:**
- Consumes: session and limiter exports from Task 1.
- Produces: `proxy(request)` plus `POST` login/logout handlers.

- [ ] **Step 1: Write failing Proxy tests**

Assert anonymous `/api/tasks` returns JSON 401, anonymous `/all?x=1` redirects to `/login?next=%2Fall%3Fx%3D1`, `/login` remains public, a valid cookie passes, and invalid/tampered cookies fail.

- [ ] **Step 2: Verify Proxy tests fail**

Run: `npm test -- tests/proxy.test.ts`
Expected: FAIL because `proxy.ts` does not exist.

- [ ] **Step 3: Implement Proxy**

Use the Next.js 16 `proxy` export and constant matcher excluding `_next/static`, `_next/image`, favicon, manifest, and common image assets. Fail closed when `SESSION_SECRET` is absent. Return JSON 401 for anonymous APIs and same-origin login redirects for pages.

- [ ] **Step 4: Implement login and logout routes**

Login accepts JSON `{ password }`, checks rate limit and configuration, compares credentials, signs the cookie, and sets secure attributes. Logout sets the same cookie to empty with `maxAge: 0`.

- [ ] **Step 5: Run boundary tests**

Run: `npm test -- tests/proxy.test.ts`
Expected: all tests pass.

### Task 3: Owner Login Experience

**Files:**
- Create: `app/login/page.tsx`
- Create: `components/LoginForm.tsx`
- Create: `components/LogoutButton.tsx`
- Modify: `components/Sidebar.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `/api/auth/login`, `/api/auth/logout`, and safe `next` query parameter.

- [ ] **Step 1: Build the public login page**

Render a branded owner-login card outside `TasksProvider`, with an accessible password label, show/hide button, submit state, generic error region, and preserved `next` path.

- [ ] **Step 2: Build logout and add it to navigation**

POST to `/api/auth/logout`, then replace navigation with `/login`. Place the control in both responsive sidebar states using the existing navigation structure.

- [ ] **Step 3: Style with existing tokens**

Add only focused login/logout styles and keep current light/dark behavior.

- [ ] **Step 4: Run build and tests**

Run: `npm test && npm run build`
Expected: tests pass and production build exits 0.

### Task 4: Configure, Deploy, and Verify Production

**Files:**
- Modify: `.env.example`

**Interfaces:**
- Consumes: Vercel project `task-manager` and stable alias `https://task-manager-seven-delta-19.vercel.app`.

- [ ] **Step 1: Document required secrets**

Add commented `APP_PASSWORD` and `SESSION_SECRET` examples without real values.

- [ ] **Step 2: Configure Vercel secrets**

Generate a 32-byte random `SESSION_SECRET`. Obtain the owner's password without printing or committing it, then set both variables for Production, Preview, and Development through Vercel CLI.

- [ ] **Step 3: Deploy production**

Run: `npx vercel --prod --yes`
Expected: successful build and stable alias update.

- [ ] **Step 4: Verify live privacy and persistence**

Confirm anonymous `/api/tasks` returns 401; invalid login returns 401; valid login sets an HTTP-only secure cookie; the authenticated task API returns 200; logout clears the cookie; the same cookie then receives 401. Confirm the live page redirects to `/login` and existing Neon tasks remain accessible after authenticated login.

- [ ] **Step 5: Final repository verification**

Run: `npm test && npm run build && git diff --check`
Expected: all tests pass, build exits 0, and no whitespace errors.
