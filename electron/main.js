// Electron wrapper: runs the Next.js server as a child process (using
// Electron's own bundled Node via ELECTRON_RUN_AS_NODE, so end users don't
// need Node.js installed) and shows it in a native window. Always forces the
// offline PGlite path — see the explicit database directory below.
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  screen,
  ipcMain,
  Tray,
  nativeImage,
  Notification,
} = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const { createServerLifecycle } = require("./server-lifecycle");

app.setName("Tempo");

// PGlite has no real cross-process lock (postmaster.pid holds its own
// placeholder PID, not a usable advisory lock), so two Tempo processes
// pointed at the same PGLITE_DIR silently corrupt it rather than refusing to
// start — this is the single biggest risk in the whole app. Refuse to be
// the second instance; hand off to the one already running instead.
if (!app.requestSingleInstanceLock()) {
  // app.quit() is async and this file runs top-to-bottom rather than inside
  // an else-branch, so without an immediate exit the rest of it — spawning
  // a second server against the same PGLITE_DIR — would run anyway before
  // quit takes effect.
  app.quit();
  process.exit(0);
}
// activateOrCreateWindow is a hoisted function declaration defined further
// down, so this is safe even though it's referenced before that point.
app.on("second-instance", () => activateOrCreateWindow());

const isDev = !app.isPackaged;
// Packaged builds take the icon from the bundle (build/icon.icns); an
// unpackaged `electron .` run would otherwise show the default Electron logo.
const iconPath = path.join(__dirname, "..", "build", "icon.png");
// electron-builder (with asar disabled) unpacks app files to resources/app.
const projectRoot = isDev ? path.join(__dirname, "..") : path.join(process.resourcesPath, "app");

// Always the literal IPv4 loopback, never "localhost": Next binds IPv4 only,
// while Chromium resolves "localhost" to ::1 first — which is why the window
// showed "This page couldn't load" against a server that was up and healthy.
// It also keeps the server off the local network.
const HOST = "127.0.0.1";

let serverProcess = null;
let mainWindow = null;
let quitting = false;
// Held at module scope on purpose — a Tray with no other reference is
// garbage-collected and silently disappears from the menu bar.
let tray = null;
let trayTickInterval = null;
let trayTimerStatus = null; // { label, startedAtMs } | null
let toggleTimerMenuItem = null;

// Shown immediately on window creation, before the local server is even
// spawned, so the app doesn't sit on a blank white window for however long
// waitForServer() takes to resolve.
// Respects the OS colour scheme via a media query in the inline CSS (rather
// than nativeTheme.shouldUseDarkColors) so the splash never has to be
// re-rendered if the OS theme changes between launches — the same query the
// app's own dark palette uses in app/globals.css.
const SPLASH_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; height: 100%; }
body { display: flex; align-items: center; justify-content: center; background: #fafafa; }
.mark { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #0052ff, #4d7cff); }
@media (prefers-color-scheme: dark) {
  body { background: #0b0d10; }
  .mark { background: linear-gradient(135deg, #4d7cff, #7c9bff); }
}
</style></head><body><div class="mark"></div></body></html>`;
const SPLASH_URL = `data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`;

/**
 * The app was called DayPlan until the Tempo rename, and the userData path is
 * derived from the app name — so an existing install's database sat under the
 * old name. Move it across once.
 *
 * This runs at load rather than inside userDataDir(): Chromium creates the
 * userData directory itself early in startup, so by the time anything of ours
 * asks for the path the destination usually exists already. Hence the second
 * branch, which rescues just the database out of a directory Chromium got to
 * first.
 */
function migrateLegacyUserData() {
  const dir = app.getPath("userData");
  const legacy = path.join(path.dirname(dir), "DayPlan");
  if (dir === legacy || !fs.existsSync(legacy)) return;

  try {
    if (!fs.existsSync(dir)) {
      fs.renameSync(legacy, dir);
      return;
    }
    // Only ever move the database into a slot nothing has claimed — never
    // overwrite a Tempo-era database with the old one.
    if (fs.existsSync(path.join(legacy, "pglite")) && !fs.existsSync(path.join(dir, "pglite"))) {
      fs.renameSync(path.join(legacy, "pglite"), path.join(dir, "pglite"));
    }
  } catch {
    // A failed move just means starting from an empty database — never fatal.
  }
}

migrateLegacyUserData();

/**
 * ~/Library/Application Support/Tempo on macOS. Chromium only creates this
 * lazily, so anything of ours that writes there has to make it first.
 */
function userDataDir() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * The desktop build gets no `.env` files — it ships as a bundle, and the
 * explicit local PGlite directory makes its data independent of a developer
 * checkout. Calendar integration still needs real values, so
 * they live in a JSON file in userData that the user (or the app) can write.
 *
 * `calendarFeedSecret` is generated on first run so subscribing from Apple
 * Calendar works out of the box; the iCloud fields start empty and stay
 * inert until filled in, exactly like the unset env vars they stand in for.
 */
function settingsFile() {
  return path.join(userDataDir(), "settings.json");
}

/**
 * Writes via a temp file + rename so a crash or force-quit mid-write can
 * never leave settings.json half-written — a torn write here would look
 * like a corrupt file on next launch and silently regenerate the calendar
 * feed secret, killing every existing Apple Calendar subscription.
 */
function writeSettingsFile(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readDesktopSettings() {
  const file = settingsFile();
  let settings = {};
  try {
    if (fs.existsSync(file)) settings = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // A hand-edited file with a syntax error must not stop the app booting —
    // fall through and rewrite it with defaults below.
    settings = {};
  }
  if (typeof settings !== "object" || settings === null) settings = {};

  const defaults = {
    calendarFeedSecret: crypto.randomBytes(32).toString("base64url"),
    icloudAppleId: "",
    icloudAppPassword: "",
    windowBounds: null,
  };
  const merged = { ...defaults, ...settings };
  // Only rewrite when something actually changed, so an untouched file keeps
  // its mtime (and any comments-by-key ordering the user gave it).
  if (JSON.stringify(merged) !== JSON.stringify(settings)) {
    try {
      writeSettingsFile(file, `${JSON.stringify(merged, null, 2)}\n`);
    } catch (err) {
      logLine(`[tempo] could not write ${file}: ${err.message}`);
    }
  }
  return merged;
}

/**
 * Merges `patch` into the settings file, reusing readDesktopSettings()'s
 * defaults-merge and 0o600 contract rather than writing raw JSON here.
 */
function writeDesktopSettings(patch) {
  const file = settingsFile();
  const current = readDesktopSettings();
  const merged = { ...current, ...patch };
  if (JSON.stringify(merged) === JSON.stringify(current)) return;
  try {
    writeSettingsFile(file, `${JSON.stringify(merged, null, 2)}\n`);
  } catch (err) {
    logLine(`[tempo] could not write ${file}: ${err.message}`);
  }
}

/**
 * A hand-edited settings.json can be syntactically valid JSON but carry a
 * nonsense windowBounds (wrong type, truncated object, negative size) —
 * screen.getDisplayMatching throws on that, which used to reject
 * createWindow() and quit the app on every subsequent launch. Anything that
 * doesn't look like a real rect is treated as "no saved bounds" instead.
 */
function isValidBounds(bounds) {
  return (
    bounds &&
    typeof bounds === "object" &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

/**
 * screen.getDisplayMatching always returns a real, currently-connected
 * display (falling back to the nearest one when the given rect doesn't
 * intersect any), so this both handles "saved on a monitor that's since been
 * unplugged" and simple resolution changes in one pass.
 */
function clampBoundsToDisplay(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height);
  return { x, y, width, height };
}

function logFile() {
  return path.join(userDataDir(), "tempo.log");
}

function logLine(text) {
  process.stdout.write(text);
  try {
    fs.appendFileSync(logFile(), text.endsWith("\n") ? text : `${text}\n`);
  } catch {
    // Logging must never take the app down.
  }
}

/**
 * The feed URL Apple Calendar stores has the port in it, and Apple re-polls
 * that exact URL for the life of the subscription — so an ephemeral port meant
 * every subscription died at the next launch. Claim a fixed port instead, with
 * a couple of neighbours as fallback for the rare case something else holds it
 * (a stale Tempo mid-shutdown, mostly). Only if all of them are taken do we
 * fall back to a random port, which still runs the app — the subscription is
 * what breaks, not the window.
 */
const PREFERRED_PORTS = [39847, 39848, 39849];

function tryPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(null));
    server.listen(port, HOST, () => {
      const actual = server.address().port;
      server.close(() => resolve(actual));
    });
  });
}

async function getFreePort() {
  for (const candidate of PREFERRED_PORTS) {
    const port = await tryPort(candidate);
    if (port) return port;
  }
  logLine(`[tempo] ports ${PREFERRED_PORTS.join(", ")} are all in use; falling back to a random one — an existing calendar subscription will not reach this session`);
  // Port 0 asks the OS for anything free, and never fails the way a fixed
  // port can, so this resolves or the app had bigger problems.
  return tryPort(0);
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  let timer = null;
  let reject;
  const promise = new Promise((res, rej) => {
    reject = rej;
    const attempt = () => {
      const req = http.get(url, (response) => {
        response.resume();
        res();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          rej(new Error("Timed out waiting for the local server to start"));
          return;
        }
        timer = setTimeout(attempt, 300);
      });
    };
    attempt();
  });
  // Lets startServer's exit/error handlers cut this short instead of
  // leaving the splash on screen for the rest of the 30s timeout.
  promise.cancel = (err) => {
    if (timer) clearTimeout(timer);
    reject(err);
  };
  return promise;
}

// Set while a createWindow() call is between spawning the server and the
// window finishing its load, so a server death in that window can reject the
// in-flight waitForServer() instead of leaving it to time out 30s later and
// then show a second, redundant dialog on top of the crash one.
let pendingServerStartup = null;

function failStartup(err) {
  if (pendingServerStartup) {
    pendingServerStartup.cancel(err);
    pendingServerStartup = null;
  } else {
    showStartupError(err.message);
  }
}

const serverLifecycle = createServerLifecycle(async () => {
  const port = await getFreePort();
  startServer(port);
  const url = `http://${HOST}:${port}`;
  const wait = waitForServer(url);
  pendingServerStartup = wait;
  try {
    await wait;
    return url;
  } finally {
    if (pendingServerStartup === wait) pendingServerStartup = null;
  }
});

function startServer(port) {
  logLine(`[tempo] starting server on port ${port} from ${projectRoot}`);
  const settings = readDesktopSettings();
  const nextBin = require.resolve("next/dist/bin/next", { paths: [projectRoot] });

  serverProcess = spawn(
    process.execPath,
    [
      // See electron/child-bootstrap.js: stops the child from taking its own
      // Dock tile.
      "--require",
      path.join(__dirname, "child-bootstrap.js"),
      nextBin,
      isDev ? "dev" : "start",
      "-H",
      HOST,
      "-p",
      String(port),
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: isDev ? "development" : "production",
        PORT: String(port),
        HOSTNAME: HOST,
        // The local database path is explicit, so the app never depends on
        // a developer checkout's environment configuration.
        // ...except the calendar values, which come from settings.json in
        // userData (see readDesktopSettings) rather than any ambient .env.
        CALENDAR_FEED_SECRET: settings.calendarFeedSecret || "",
        ICLOUD_APPLE_ID: settings.icloudAppleId || "",
        ICLOUD_APP_PASSWORD: settings.icloudAppPassword || "",
        PGLITE_DIR: path.join(userDataDir(), "pglite"),
      },
      // A GUI launch has nowhere to inherit stdout to, so the server's output
      // (including the reason it died) used to vanish. Tee it to a log file
      // next to the database instead.
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  serverProcess.stdout.on("data", (chunk) => logLine(chunk.toString()));
  serverProcess.stderr.on("data", (chunk) => logLine(chunk.toString()));

  serverProcess.on("error", (err) => {
    serverProcess = null;
    serverLifecycle.reset();
    failStartup(new Error(`Could not start the local server: ${err.message}`));
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    serverLifecycle.reset();
    // A null code means we killed it ourselves on quit.
    if (code !== null && code !== 0) {
      failStartup(new Error(`The local server exited with code ${code}.`));
    }
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  serverLifecycle.reset();
}

/**
 * A dead server used to surface as Chromium's blank "This page couldn't load"
 * screen, which says nothing about what actually broke. Show the reason
 * instead, in the window if there is one and in a dialog if there isn't.
 */
function showStartupError(message) {
  logLine(`[tempo] ${message}`);
  if (quitting) return;
  dialog.showErrorBox("Tempo couldn't start", `${message}\n\nDetails: ${logFile()}`);
}

/**
 * Renderer commands travel over one fixed channel as a tagged object —
 * never a caller-supplied channel name — so DesktopBridge on the other end
 * has a single, typed onCommand subscription to maintain.
 */
function sendCommand(command) {
  mainWindow?.webContents.send("tempo:command", command);
}

/**
 * The iCloud credentials have no in-app editor, so give the settings file a
 * way to be opened that doesn't involve knowing the userData path. Built on
 * top of the default menu rather than replacing it — the standard Edit/Window
 * items (copy, paste, minimise) are load-bearing on macOS. View and Task are
 * app-specific menus rather than everything living under File — that's a
 * large part of what makes the menu bar read as a native app's, not a
 * website's.
 */
function installMenu() {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      role: "fileMenu",
      submenu: [
        {
          label: "Calendar Integration Settings…",
          click: async () => {
            readDesktopSettings();
            await shell.openPath(settingsFile());
          },
        },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Search", accelerator: "CmdOrCtrl+F", click: () => sendCommand({ type: "focus-search" }) },
        { type: "separator" },
        { label: "Today", accelerator: "CmdOrCtrl+1", click: () => sendCommand({ type: "navigate", path: "/" }) },
        { label: "Calendar", accelerator: "CmdOrCtrl+2", click: () => sendCommand({ type: "navigate", path: "/calendar" }) },
        { label: "Tracking", accelerator: "CmdOrCtrl+3", click: () => sendCommand({ type: "navigate", path: "/tracking" }) },
        { label: "Next 7 Days", accelerator: "CmdOrCtrl+4", click: () => sendCommand({ type: "navigate", path: "/upcoming" }) },
        { label: "All Tasks", accelerator: "CmdOrCtrl+5", click: () => sendCommand({ type: "navigate", path: "/all" }) },
        { type: "separator" },
        { label: "Settings…", accelerator: "CmdOrCtrl+,", click: () => sendCommand({ type: "navigate", path: "/settings" }) },
      ],
    },
    {
      label: "Task",
      submenu: [
        { label: "New Task", accelerator: "CmdOrCtrl+N", click: () => sendCommand({ type: "new-task" }) },
        { type: "separator" },
        {
          id: "toggle-timer",
          label: "Start/Stop Timer",
          accelerator: "CmdOrCtrl+Shift+T",
          // Disabled until the renderer reports a running timer or an open
          // task to act on — otherwise this fires with nothing to toggle
          // and gives the user no indication anything happened.
          enabled: false,
          click: () => sendCommand({ type: "toggle-timer" }),
        },
      ],
    },
    { role: "windowMenu" },
  ];
  const menu = Menu.buildFromTemplate(template);
  toggleTimerMenuItem = menu.getMenuItemById("toggle-timer");
  Menu.setApplicationMenu(menu);
}

/**
 * Cheapest native win after the titlebar: a right-click in a text field gets
 * Cut/Copy/Paste, a right-click on selected text gets Copy — instead of
 * Chromium's built-in menu (or nothing at all).
 */
function installContextMenu() {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("context-menu", (_e, params) => {
      const items = [];
      if (params.isEditable) {
        items.push({ role: "cut", enabled: params.editFlags.canCut });
        items.push({ role: "copy", enabled: params.editFlags.canCopy });
        items.push({ role: "paste", enabled: params.editFlags.canPaste });
      } else if (params.selectionText) {
        items.push({ role: "copy" });
      }
      if (items.length === 0) return;
      Menu.buildFromTemplate(items).popup();
    });
  });
}

function formatTrayElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// A raw task title can run to a full sentence, and the menu bar has no
// wrapping — left unbounded it pushes Tempo's own View/Task menus off the
// right edge of the screen on a 13" display.
const TRAY_LABEL_MAX = 24;

function truncateTrayLabel(label) {
  return label.length > TRAY_LABEL_MAX ? `${label.slice(0, TRAY_LABEL_MAX - 1)}…` : label;
}

function updateTrayTitle() {
  if (!tray) return;
  if (!trayTimerStatus) {
    tray.setTitle("");
    return;
  }
  const elapsed = formatTrayElapsed(Date.now() - trayTimerStatus.startedAtMs);
  tray.setTitle(` ${truncateTrayLabel(trayTimerStatus.label)} · ${elapsed}`);
}

/**
 * A time tracker's highest-value native addition: the running timer visible
 * (and stoppable-by-glancing-at) from the menu bar without switching to the
 * app at all. Click toggles the window rather than opening a menu, matching
 * how most menu-bar-timer apps behave.
 */
function createTray() {
  if (process.platform !== "darwin") return;
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  tray.setToolTip("Tempo");
  tray.on("click", () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
      return;
    }
    // A hidden window still counts toward BrowserWindow.getAllWindows(), so
    // Dock-click "activate" does nothing for it — the tray is the only way
    // back once a window has been hidden this way, and it has to actually
    // work.
    activateOrCreateWindow();
  });
  trayTickInterval = setInterval(updateTrayTitle, 1000);
}

ipcMain.on("tempo:set-badge", (_event, count) => {
  if (process.platform !== "darwin" || !app.dock) return;
  app.dock.setBadge(count > 0 ? String(count) : "");
});

ipcMain.on("tempo:timer-status", (_event, status) => {
  trayTimerStatus = status ? { label: status.label, startedAtMs: new Date(status.startedAt).getTime() } : null;
  updateTrayTitle();
});

ipcMain.on("tempo:can-toggle-timer", (_event, canToggle) => {
  if (toggleTimerMenuItem) toggleTimerMenuItem.enabled = Boolean(canToggle);
});

ipcMain.on("tempo:notify", (_event, title, options) => {
  if (!Notification.isSupported()) return;
  new Notification({ title, body: options?.body, icon: iconPath }).show();
});

async function createWindow() {
  const settings = readDesktopSettings();
  const restoredBounds = isValidBounds(settings.windowBounds)
    ? clampBoundsToDisplay(settings.windowBounds)
    : null;

  mainWindow = new BrowserWindow({
    ...(restoredBounds ?? { width: 1280, height: 860 }),
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Tempo",
    icon: iconPath,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: "sidebar",
    visualEffectState: "followWindow",
    // The vibrancy material needs to show through, so the window itself must
    // not paint an opaque background behind the page — the opaque paint
    // moves onto the content pane in CSS instead.
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // The preload bridge (window.tempo) is attached to this window, not to an
  // origin — anything that navigated the window itself off-origin would
  // carry that bridge to a remote page. Nothing renders an external link
  // today, but this closes the door before something does.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(`http://${HOST}:`)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.on("close", () => {
    if (!mainWindow || mainWindow.isFullScreen() || mainWindow.isMinimized()) return;
    // Synchronous write on purpose: this runs during window teardown, and an
    // async write here could get torn down mid-write by app quit.
    writeDesktopSettings({ windowBounds: mainWindow.getBounds() });
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Shows the window immediately with a branded placeholder rather than
  // leaving it blank for however long the server takes to come up.
  await mainWindow.loadURL(SPLASH_URL);

  await mainWindow.loadURL(await serverLifecycle.getUrl());
}

/**
 * `mainWindow` is assigned synchronously as the first thing createWindow()
 * does, before its first await, so by the time this function returns there
 * is no window in one call it doesn't already know about — a second Dock
 * click or Tray click while startup is still in flight always lands in the
 * `mainWindow` branch below instead of spawning a second Next.js server on a
 * second port with the same PGLITE_DIR.
 */
function activateOrCreateWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow().catch((err) => {
    showStartupError(`Failed to start Tempo: ${err.message}`);
    app.quit();
  });
}

app.whenReady().then(() => {
  installMenu();
  installContextMenu();
  createTray();
  if (isDev && process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }

  activateOrCreateWindow();

  app.on("activate", activateOrCreateWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  stopServer();
  if (trayTickInterval) clearInterval(trayTickInterval);
});
process.on("exit", stopServer);
