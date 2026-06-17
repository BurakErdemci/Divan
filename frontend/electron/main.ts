import { app, BrowserWindow } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_PORT = Number(process.env.DIVAN_BACKEND_PORT || '8000');
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`;

let backendProcess: ChildProcessWithoutNullStreams | null = null;

function projectRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function backendDir() {
  return path.join(projectRoot(), 'backend');
}

function backendPython() {
  const root = backendDir();
  const candidates = process.platform === 'win32'
    ? [path.join(root, '.venv', 'Scripts', 'python.exe')]
    : [path.join(root, '.venv', 'bin', 'python')];
  return candidates.find((candidate) => fs.existsSync(candidate)) || 'python';
}

function checkBackendHealth(timeoutMs = 700): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_URL, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackendReady(timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await checkBackendHealth()) return true;
    await sleep(300);
  }
  return false;
}

async function startBackend() {
  if (await checkBackendHealth()) {
    console.log(`[divan] Backend already running on ${BACKEND_HEALTH_URL}`);
    return;
  }

  const cwd = backendDir();
  const python = backendPython();
  backendProcess = spawn(
    python,
    ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
    {
      cwd,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
      },
      windowsHide: true,
    },
  );

  backendProcess.stdout.on('data', (chunk) => {
    console.log(`[backend] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.stderr.on('data', (chunk) => {
    console.error(`[backend] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.on('exit', (code, signal) => {
    console.log(`[divan] Backend exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
    backendProcess = null;
  });

  if (await waitForBackendReady()) {
    console.log(`[divan] Backend ready on ${BACKEND_HEALTH_URL}`);
  } else {
    console.error(`[divan] Backend did not become ready in time: ${BACKEND_HEALTH_URL}`);
  }
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
  backendProcess = null;
}

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

app.whenReady().then(async () => {
  await startBackend().catch((err) => {
    console.error('[divan] Backend start failed', err);
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
