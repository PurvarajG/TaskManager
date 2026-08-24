import { readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import worker from "../../site/worker/index.js";

const downloadUrl =
  "https://github.com/PurvarajG/TaskManager/releases/latest/download/Tempo-latest-arm64.dmg";
const execFile = promisify(execFileCallback);

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
    expect(worker).toContain("env.ASSETS.fetch");
  });

  it("places public assets in the Sites client directory", async () => {
    await execFile(process.execPath, ["build.mjs"], { cwd: "site" });

    await expect(readFile("site/dist/client/index.html", "utf8")).resolves.toContain(
      "Tempo — Your day, at a glance",
    );
    await expect(readFile("site/dist/client/styles.css", "utf8")).resolves.toContain(
      ".site-shell",
    );
  });

  it("serves the static document for the public root URL", async () => {
    const fetchAsset = vi.fn().mockResolvedValue(new Response("Tempo"));
    const response = await worker.fetch(
      new Request("https://tempo-download.purvarajg1.chatgpt.site/"),
      { ASSETS: { fetch: fetchAsset } },
    );

    expect(fetchAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://tempo-download.purvarajg1.chatgpt.site/index.html",
      }),
    );
    expect(await response.text()).toBe("Tempo");
  });
});
