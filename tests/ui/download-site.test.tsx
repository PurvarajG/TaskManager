import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const downloadUrl =
  "https://github.com/PurvarajG/TaskManager/releases/latest/download/Tempo-latest-arm64.dmg";

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

    expect(workflow).toContain('tags: ["v*"]');
    expect(workflow).toContain("npm run electron:build");
    expect(workflow).toContain("Tempo-latest-arm64.dmg");
    expect(workflow).toContain("softprops/action-gh-release");
  });

  it("builds a static Sites worker without introducing application state", async () => {
    const [packageJson, worker] = await Promise.all([
      readFile("site/package.json", "utf8"),
      readFile("site/worker/index.js", "utf8"),
    ]);

    expect(packageJson).toContain('"build": "node build.mjs"');
    expect(worker).toContain("env.ASSETS.fetch(request)");
  });
});
