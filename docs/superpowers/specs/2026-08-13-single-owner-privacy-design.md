# Single-Owner Privacy Design

## Goal

Protect the entire Task Manager with one owner password. Unauthenticated visitors must not be able to view the interface or read, create, change, or delete data through API requests.

## Scope

- One owner, one password, and no registration flow.
- A dedicated `/login` page and a visible logout action.
- Protection for all application pages and every `/api/*` route.
- Existing tasks and the Neon database schema remain unchanged.
- Authentication secrets live only in environment variables.

Multi-user accounts, email delivery, password recovery, roles, and per-user task ownership are outside this feature.

## Architecture

### Credentials

Production receives two Vercel environment variables:

- `APP_PASSWORD`: the owner's chosen password.
- `SESSION_SECRET`: a randomly generated high-entropy signing secret.

Neither value is committed to the repository or returned to the browser. Local development uses the same variable names from `.env.local`.

### Login

`POST /api/auth/login` accepts a password over HTTPS. The server compares it with `APP_PASSWORD` using a timing-safe comparison. A successful request returns a signed session in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. The cookie lasts 30 days and contains only session metadata, never the password.

Failed requests return a generic authentication error. The endpoint rate-limits repeated attempts by a privacy-preserving fingerprint derived from request metadata. The limiter bounds memory use and returns HTTP 429 with a retry delay after the threshold is exceeded. This is defense in depth; Vercel's edge/network controls remain the stronger distributed layer.

### Authorization

A root `proxy.ts` performs an early session check for every page and API request except the login page, login endpoint, and required static assets.

- Unauthenticated page requests redirect to `/login` and preserve a safe same-origin return path.
- Unauthenticated API requests receive JSON with HTTP 401.
- Authenticated requests continue normally.

The session verification code is shared by login, logout, and proxy enforcement. It validates the signature and expiry before granting access. Return paths are restricted to same-origin application paths to prevent open redirects.

### Logout

`POST /api/auth/logout` expires the session cookie. The client then navigates to `/login`. Logout is available in both desktop and mobile navigation.

## User Experience

The login page uses the app's existing visual tokens and supports light and dark themes. It contains a password field, show/hide control, submit button, loading state, and clear generic error message. It does not reveal whether configuration or a submitted credential caused a failure.

After login, the owner returns to the originally requested safe application path or Today by default. A valid session keeps the owner signed in for 30 days.

## Configuration Failure

If either required environment variable is missing in production, authentication fails closed: protected routes remain inaccessible and login returns a generic service-unavailable response. No development fallback password is embedded in source code.

## Testing

Automated tests cover:

- Session signing, successful verification, tampering, and expiry.
- Valid and invalid password comparison.
- Safe and unsafe return-path handling.
- Login rate-limit behavior and bounded cleanup.
- Page redirects and API 401 responses without a session.
- Login success, cookie attributes, logout, and protected API access.

Release verification covers a production build plus live checks that an anonymous API request is rejected, login succeeds with the configured password, an authenticated API request succeeds, logout invalidates access, and existing Neon data remains available.

## Deployment

Before the production deployment, set `APP_PASSWORD` and a generated `SESSION_SECRET` for Vercel Production, Preview, and Development. Redeploy with `npx vercel --prod`. Verify the privacy boundary against the stable production alias before declaring completion.
