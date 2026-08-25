// electron-builder afterPack hook.
//
// `next build` writes symlinks under .next/node_modules for every package in
// serverExternalPackages (e.g. .next/node_modules/@electric-sql/pglite-<hash>
// -> ../../../node_modules/@electric-sql/pglite), and the compiled server
// imports the packages under those hashed names. electron-builder's file
// walker drops that directory, so the packaged server failed at runtime with
// "Cannot find package '@electric-sql/pglite-<hash>'". Recreate the links —
// they are relative, and the layout inside the bundle matches the project, so
// they resolve as-is.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

exports.default = async function afterPack(context) {
  const source = path.join(context.packager.projectDir, ".next", "node_modules");

  if (fs.existsSync(source)) {
    const appName = context.packager.appInfo.productFilename;
    const target =
      context.electronPlatformName === "darwin"
        ? path.join(context.appOutDir, `${appName}.app`, "Contents", "Resources", "app", ".next", "node_modules")
        : path.join(context.appOutDir, "resources", "app", ".next", "node_modules");

    let linked = 0;
    const copyTree = (from, to) => {
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, entry.name);
        const dest = path.join(to, entry.name);
        if (entry.isSymbolicLink()) {
          fs.rmSync(dest, { recursive: true, force: true });
          fs.symlinkSync(fs.readlinkSync(src), dest);
          linked++;
        } else if (entry.isDirectory()) {
          copyTree(src, dest);
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    };

    copyTree(source, target);
    console.log(`  • restored .next/node_modules  links=${linked}`);
  }

  // This hook may add files to the bundle above (and electron-builder runs
  // with asar disabled), which invalidates Electron's own ad-hoc code signature —
  // its seal no longer matches the bundle contents. With no Developer ID
  // configured (identity: null), electron-builder never re-signs after this
  // hook, so the mismatch survives into the shipped app. Gatekeeper then
  // rejects it outright as "damaged" (not just "unidentified developer")
  // the moment it crosses a quarantine boundary — AirDrop, a download link,
  // anything but running it unquarantined on the machine that built it.
  // Always re-sealing macOS after all possible mutations (still no Developer
  // ID needed) fixes that; the
  // recipient still sees the normal unidentified-developer prompt, bypassed
  // with right-click > Open.
  if (context.electronPlatformName === "darwin") {
    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(context.appOutDir, `${appName}.app`);
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
    console.log(`  • ad-hoc re-signed  app=${appPath}`);
  }
};
