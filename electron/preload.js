// Bridges a small, fixed set of methods into the renderer via
// contextBridge. Every channel name below is a literal — nothing here takes
// a caller-supplied channel or exposes ipcRenderer itself, so nothing in the
// renderer can reach past this surface into Node or Electron internals.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tempo", {
  onCommand(callback) {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("tempo:command", listener);
    return () => ipcRenderer.removeListener("tempo:command", listener);
  },
  setBadge(count) {
    ipcRenderer.send("tempo:set-badge", count);
  },
  setTimerStatus(status) {
    ipcRenderer.send("tempo:timer-status", status);
  },
  setCanToggleTimer(canToggle) {
    ipcRenderer.send("tempo:can-toggle-timer", canToggle);
  },
  notify(title, options) {
    ipcRenderer.send("tempo:notify", title, options);
  },
  platform: process.platform,
});
