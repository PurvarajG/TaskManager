// Preloaded (via --require) into the Next.js server child process.
//
// Next sets `process.title = "next-server (vX)"` on startup. On macOS libuv
// implements that through LaunchServices, which checks the process in as a
// foreground application — so the child got its own Dock tile, showing the
// generic "exec" executable icon next to the real app. Verified by running
// the packaged binary with ELECTRON_RUN_AS_NODE and nothing else: no tile
// until `process.title` is assigned, then a second tile appears.
//
// Making the property a no-op keeps the Dock to one tile. Nothing depends on
// the title; `ps` still shows the executable path.
if (process.platform === "darwin") {
  const title = process.title;
  Object.defineProperty(process, "title", {
    configurable: true,
    enumerable: true,
    get: () => title,
    set: () => {},
  });
}
