// Electron wrapper: runs the Next.js server as a child process (using
// Electron's own bundled Node via ELECTRON_RUN_AS_NODE, so end users don't
// need Node.js installed) and shows it in a native window. Always forces the
// offline PGlite path — see the blanked env vars below.
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const net = require("node:net");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");

app.setName("Tempo");

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
 * blanked env vars in startServer() deliberately ignore any that happen to sit
 * in a developer checkout. Calendar integration still needs real values, so
 * they live in a JSON file in userData that the user (or the app) can write.
 *
 * `calendarFeedSecret` is generated on first run so subscribing from Apple
 * Calendar works out of the box; the iCloud fields start empty and stay
 * inert until filled in, exactly like the unset env vars they stand in for.
 */
function settingsFile() {
  return path.join(userDataDir(), "settings.json");
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
  };
  const merged = { ...defaults, ...settings };
  // Only rewrite when something actually changed, so an untouched file keeps
  // its mtime (and any comments-by-key ordering the user gave it).
  if (JSON.stringify(merged) !== JSON.stringify(settings)) {
    try {
      fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`, { mode: 0o600 });
    } catch (err) {
      logLine(`[tempo] could not write ${file}: ${err.message}`);
    }
  }
  return merged;
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
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for the local server to start"));
          return;
        }
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

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
        // Force the embedded, offline PGlite database and disable the
        // single-owner login gate, no matter what an ambient .env.local
        // (e.g. from a developer checkout) sets — same trick as `dev:lab`
        // in package.json. Next only reads .env files for vars that aren't
        // already present in process.env, so blanking these wins.
        POSTGRES_URL: "",
        DATABASE_URL: "",
        POSTGRES_URL_NON_POOLING: "",
        SESSION_SECRET: "",
        APP_PASSWORD: "",
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
    showStartupError(`Could not start the local server: ${err.message}`);
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    // A null code means we killed it ourselves on quit.
    if (code !== null && code !== 0) {
      showStartupError(`The local server exited with code ${code}.`);
    }
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
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
 * The iCloud credentials have no in-app editor, so give the settings file a
 * way to be opened that doesn't involve knowing the userData path. Built on
 * top of the default menu rather than replacing it — the standard Edit/Window
 * items (copy, paste, minimise) are load-bearing on macOS.
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
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const port = await getFreePort();
  startServer(port);

  const url = `http://${HOST}:${port}`;
  await waitForServer(url);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    title: "Tempo",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
}

app.whenReady().then(() => {
  installMenu();
  if (isDev && process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }

  createWindow().catch((err) => {
    showStartupError(`Failed to start Tempo: ${err.message}`);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  stopServer();
});
process.on("exit", stopServer);
