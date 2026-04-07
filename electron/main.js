const { app, BrowserWindow, session, Menu, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

// ─── Window factory ─────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width:     1440,
    height:    860,
    minWidth:  1024,
    minHeight: 640,
    title:     'MIDI Chord Finder',
    icon:      path.join(__dirname, '../public/256.png'),
    backgroundColor: '#ffffff',
    show: false,  // prevent white flash before content loads
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    },
  });

  // ── Auto-approve MIDI + media permissions ────────────────────────────────
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['midi', 'midiSysex', 'media', 'audioCapture'].includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return ['midi', 'midiSysex', 'media', 'audioCapture'].includes(permission);
  });

  // ── Content Security Policy ───────────────────────────────────────────────
  // Allows the CDN audio samples + Google Fonts to load inside Electron
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: " +
          "https://tonejs.github.io https://gleitz.github.io " +
          "https://fonts.googleapis.com https://fonts.gstatic.com"
        ],
      },
    });
  });

  // ── Load URL or static file ───────────────────────────────────────────────
  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../out/index.html'));
  }

  // Show only when painted — no white flash
  win.once('ready-to-show', () => win.show());

  // Open target="_blank" links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // Clean, menu-less app shell
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Security hardening ──────────────────────────────────────────────────────

app.on('web-contents-created', (_e, contents) => {
  // Block navigation to arbitrary URLs in production
  contents.on('will-navigate', (event, url) => {
    if (!isDev && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });
});
