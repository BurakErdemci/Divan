import { spawn } from 'child_process';
import electron from 'electron';

const devServerUrl = 'http://localhost:5173';

const env = {
  ...process.env,
  VITE_DEV_SERVER_URL: devServerUrl,
};

// Start Electron process pointing to the frontend root folder (which contains the dist-electron main.js)
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('close', (code) => {
  process.exit(code || 0);
});
