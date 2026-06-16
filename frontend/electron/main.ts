import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Divan - Karar Destek Arayüzü",
    icon: path.join(__dirname, '../dist/favicon.ico'), // or raw icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove default menu bar for Visual Novel feel
  win.setMenuBarVisibility(false);

  // If VITE_DEV_SERVER_URL is set, load that URL. Otherwise load index.html from dist/
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
    // DevTools (konsol paneli) artık otomatik açılmıyor — VN penceresi temiz açılsın.
    // Hata ayıklamak isteyince: DIVAN_DEVTOOLS=1 ile başlat (veya F12).
    if (process.env.DIVAN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
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
