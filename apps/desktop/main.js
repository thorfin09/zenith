const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const isDev = !app.isPackaged;
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Zenith Daily Planner",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove default menu bar
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // Open Developer Tools in dev mode
    win.webContents.openDevTools();
  } else {
    // Load build output
    win.loadFile(path.join(__dirname, 'dist-client/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
