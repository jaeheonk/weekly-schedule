import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverRoot = path.resolve(webRoot, '../server');

const port = process.env.PORT || '3001';
const env = {
  ...process.env,
  PORT: port,
  BROWSER: 'none',
  VITE_DEV_PROXY_TARGET: process.env.VITE_DEV_PROXY_TARGET || `http://localhost:${port}`,
};

const children = [];
let shuttingDown = false;

function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    detached: true,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    shutdown(signal ? 0 : code ?? 1);
  });
  return child;
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const viteArgs = [];
if (process.env.VITE_DEV_PORT) {
  viteArgs.push('--port', process.env.VITE_DEV_PORT, '--strictPort');
}

start(path.join(serverRoot, 'node_modules/.bin/tsx'), ['watch', 'src/index.ts'], serverRoot);
start(path.join(webRoot, 'node_modules/.bin/vite'), viteArgs, webRoot);
