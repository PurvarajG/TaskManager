# Tempo

Tempo is a macOS task manager and time tracker. The desktop app runs a local
Next.js server inside Electron and keeps its data in a local PGlite database;
it does not need a deployed web service or a remote database.

## Run from source

```bash
npm install
npm run electron:dev
```

For browser-only development, use `npm run dev`. This uses a local database at
`.data/pglite` unless `PGLITE_DIR` is set.

## Build the Mac app

```bash
npm run electron:build
```

The unsigned Apple-silicon DMG is written to `dist-electron/`.

## Data and backup

The packaged app stores its database in
`~/Library/Application Support/Tempo/pglite` (and migrates the old DayPlan
location once when present). Quit Tempo before copying that folder. Time
Machine is the supported backup mechanism.

## Checks

```bash
npm test
npm run electron:pack
```
