const { contextBridge, ipcRenderer } = require('electron');

// Safely expose a minimal API surface to the Next.js renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  // Expand here later for: native file dialogs, system tray, auto-updater, etc.
});
