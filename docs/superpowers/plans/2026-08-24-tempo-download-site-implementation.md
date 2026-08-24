# Tempo Download Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a polished, static Tempo download page and a tag-triggered release workflow that continuously serves the newest Apple-silicon DMG through GitHub Releases.

**Architecture:** Keep the public site in an isolated `site/` surface so it cannot inherit the desktop app's local PGlite APIs or Electron-specific chrome. The page is semantic HTML and CSS with no runtime dependencies or data fetching. A GitHub Actions workflow builds the existing Electron package on an Apple-silicon runner, names the disk image consistently, then publishes it on the matching GitHub Release.

**Tech Stack:** Static HTML/CSS; existing Tempo brand mark; GitHub Actions; Electron Builder; Vitest.

## Global Constraints

- The download URL is exactly `https://github.com/PurvarajG/TaskManager/releases/latest/download/Tempo-latest-arm64.dmg`.
- The page supports Apple Silicon Macs only and must not imply Intel support.
- The page is static: no GitHub API calls, authentication, analytics, cookies, or stored user data.
- Reuse Tempo's blue brand mark; use a warm neutral surface and editorial typography without generated imagery.
- Each tagged release uploads a single asset named exactly `Tempo-latest-arm64.dmg`.

---

### Task 1: Cover static-page content and release-contract invariants

**Files:**
- Create: `tests/ui/download-site.test.tsx`
- Create: `site/index.html`
- Create: `site/styles.css`
- Create: `site/tempo-mark.svg`
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: the documented stable DMG URL and existing Electron script `npm run electron:build`.
- Produces: a static landing page and a release workflow whose public and release-asset contracts are locked down by tests.

- [ ] **Step 1: Write the failing test**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const downloadUrl = "https://github.com/PurvarajG/TaskManager/releases/latest/download/Tempo-latest-arm64.dmg";

describe("Tempo download site", () => {
  it("offers the stable Apple-silicon DMG and accurate local-first trust copy", async () => {
    const page = await readFile("site/index.html", "utf8");
    expect(page).toContain(downloadUrl);
    expect(page).toContain("Download for Apple Silicon");
    expect(page).toContain("local PGlite data");
    expect(page).toContain("No account");
  });

  it("publishes the DMG using the stable latest-download filename", async () => {
    const workflow = await readFile(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("tags: [\"v*\"]");
    expect(workflow).toContain("npm run electron:build");
    expect(workflow).toContain("Tempo-latest-arm64.dmg");
    expect(workflow).toContain("softprops/action-gh-release");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/download-site.test.tsx`

Expected: FAIL because `site/index.html` and `.github/workflows/release.yml` do not exist.

- [ ] **Step 3: Write the minimal static site and workflow**

Create a semantic `site/index.html` page with a landmark header, main hero, primary download link, requirements section, support link to `https://github.com/PurvarajG/TaskManager`, and a modest footer. Use `site/styles.css` for responsive styles, focus indicators, and reduced-motion behavior. Copy `brand/tempo-mark.svg` to `site/tempo-mark.svg` so the independent static surface has the existing brand asset.

Create `.github/workflows/release.yml` with `push.tags: ["v*"]`, `contents: write` permission, `macos-14` runner, Node 22 setup, `npm ci`, `npm run electron:build`, a shell step that locates the one arm64 DMG in `dist-electron/` and copies it to `dist-electron/Tempo-latest-arm64.dmg`, and `softprops/action-gh-release@v2` uploading that exact file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/download-site.test.tsx`

Expected: PASS with two tests.

### Task 2: Validate the full delivery surface

**Files:**
- Modify: `site/index.html`
- Modify: `site/styles.css`
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: the static-page and release-contract files from Task 1.
- Produces: a validated static page that has no app-runtime dependencies and a syntactically valid release workflow.

- [ ] **Step 1: Inspect the page contract through the test suite**

Run: `npx vitest run tests/ui/download-site.test.tsx`

Expected: PASS with two tests before final validation.

- [ ] **Step 2: Run project quality checks**

Run: `npm run lint && npm run test`

Expected: ESLint completes without errors and all existing unit/UI tests pass.

- [ ] **Step 3: Verify static delivery files manually**

Run: `rg -n "Tempo-latest-arm64\\.dmg|Download for Apple Silicon|Apple Silicon|No account|PGlite" site/index.html .github/workflows/release.yml`

Expected: page copy and workflow both use the stable asset contract; no API endpoint or token appears in the static files.
