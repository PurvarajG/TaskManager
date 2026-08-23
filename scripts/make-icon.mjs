// Builds build/icon.png + build/icon.icns for the Electron app from the
// Tempo brand package in brand/icons.
//
// The PNGs are the design source of truth (see brand/tempo-mark.svg for the
// vector mark); this script only assembles them into the .iconset matrix
// macOS wants and hands that to iconutil. Run with `npm run electron:icon`.
import { copyFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const icons = path.join(root, "brand", "icons");
const buildDir = path.join(root, "build");
mkdirSync(buildDir, { recursive: true });

const source = (size) => {
  const file = path.join(icons, `icon-${size}.png`);
  if (!existsSync(file)) throw new Error(`Missing brand icon: ${file}`);
  return file;
};

copyFileSync(source(1024), path.join(buildDir, "icon.png"));

// iconutil wants an .iconset folder with the canonical size/@2x matrix, where
// each @2x is just the next size up rendered at the same physical dimensions.
const iconset = path.join(buildDir, "icon.iconset");
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset);
for (const size of [16, 32, 128, 256, 512]) {
  copyFileSync(source(size), path.join(iconset, `icon_${size}x${size}.png`));
  copyFileSync(source(size * 2), path.join(iconset, `icon_${size}x${size}@2x.png`));
}
execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(buildDir, "icon.icns")]);
rmSync(iconset, { recursive: true, force: true });

console.log("Wrote build/icon.png and build/icon.icns from brand/icons");
