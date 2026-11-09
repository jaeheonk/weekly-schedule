import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import {
  BlobStorage,
  SyncLatestResponse,
  UploadPayload,
  UploadResponse,
  VercelBlobItem,
} from './types.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');
const EDITED_TITLE = '프록시 확인용 수학 시간';

/**
 * Seam: the Vite dev server's public /api path.
 * Catches a missing or mis-targeted proxy, and a snapshot the native schema cannot read.
 * Misses Safari's own network stack; that check is manual.
 */
class MemoryBlobStorage implements BlobStorage {
  private readonly stored = new Map<
    string,
    { item: VercelBlobItem; snapshot: Record<string, unknown> }
  >();

  async getLatestSnapshot(familyCode: string): Promise<SyncLatestResponse> {
    const matches = [...this.stored.values()].filter((entry) =>
      entry.item.pathname.startsWith(`families/${familyCode}/`)
    );
    matches.sort((a, b) => b.item.pathname.localeCompare(a.item.pathname));
    if (matches.length === 0) {
      return { latest: null, snapshot: null, allBlobs: [] };
    }
    return {
      latest: matches[0].item,
      snapshot: matches[0].snapshot,
      allBlobs: matches.map((entry) => entry.item),
    };
  }

  async uploadSnapshot(payload: UploadPayload): Promise<UploadResponse> {
    const pathname = `families/${payload.familyCode}/state-17000001000000-web.json`;
    const item = { url: `memory://${pathname}`, pathname };
    this.stored.set(pathname, { item, snapshot: payload.snapshot });
    return { url: item.url, pathname };
  }
}

function editedSnapshot() {
  return {
    schemaVersion: 5,
    familyCode: 'proxy-e2e',
    updatedAt: 1_700_000_100,
    updatedByRole: '👦 아이 웹',
    updatedByDeviceId: 'web-e2e',
    parentPinCode: '160125',
    parentPinUpdatedAt: 1_700_000_000,
    items: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        weekday: 1,
        startHour: 16,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
        title: EDITED_TITLE,
        note: '',
        category: 'study',
        iconName: 'book',
        subTasks: [],
        isNotificationEnabled: false,
        notificationLeadMinutes: [0],
        targetWeekKey: null,
        updatedAt: 1_700_000_100,
      },
    ],
    deletedItemTimestamps: {},
    weeklyOverrides: {},
    completionFlags: {},
    subTaskCompletionFlags: {},
    parentVerifiedFlags: {},
    parentVerifiedSubTaskFlags: {},
    itemReactions: {},
    praiseNotes: [],
    rewardRedemptions: [],
    archivedEarnedHearts: 0,
    rewardPresets: [],
    deletedRewardPresetTimestamps: {},
    starTransactions: [],
    starRedemptionRequests: [],
    starRewardPresets: [],
    deletedStarPresetTimestamps: {},
    revokedStarTransactionIds: [],
    revokedStarRedemptionIds: [],
    revokedPraiseNoteIds: [],
  };
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('무료 포트를 찾지 못했습니다.'));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

function closeServer(server: Server | null): Promise<void> {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function killProcessGroup(child: ChildProcess | null): Promise<void> {
  if (!child?.pid || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  });
}

function waitForLog(child: ChildProcess, patterns: RegExp[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`로그를 기다리다 시간 초과.\n${buffer}`));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (!patterns.every((pattern) => pattern.test(buffer))) return;
      clearTimeout(timer);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      resolve(buffer);
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`프로세스가 일찍 종료되었습니다 (${code}).\n${buffer}`));
    });
  });
}

describe('local Vite proxy', () => {
  let proxyServer: Server | null = null;
  let viteProcess: ChildProcess | null = null;

  afterEach(async () => {
    await killProcessGroup(viteProcess);
    viteProcess = null;
    await closeServer(proxyServer);
    proxyServer = null;
  });

  it(
    'saves a 클라우드 동기화 스냅샷 through the Vite dev server and loads it back as schemaVersion 5',
    async () => {
      const proxyPort = await freePort();
      const vitePort = await freePort();
      const app = createApp({ blobStorage: new MemoryBlobStorage() });
      proxyServer = createServer(app);
      await listen(proxyServer, proxyPort);

      const viteBin = path.join(webRoot, 'node_modules/.bin/vite');
      viteProcess = spawn(
        viteBin,
        ['--port', String(vitePort), '--strictPort', '--host', '127.0.0.1'],
        {
          cwd: webRoot,
          detached: true,
          env: {
            ...process.env,
            VITE_DEV_PROXY_TARGET: `http://127.0.0.1:${proxyPort}`,
            BROWSER: 'none',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );

      const viteLog = await waitForLog(
        viteProcess,
        [/Local:\s+http:\/\/(?:localhost|127\.0\.0\.1):\d+/],
        20_000
      );
      const actualVitePort = Number(
        viteLog.match(/Local:\s+http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)?.[1]
      );
      const origin = `http://127.0.0.1:${actualVitePort}`;
      const snapshot = editedSnapshot();

      const uploadRes = await fetch(`${origin}/api/sync/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          familyCode: 'proxy-e2e',
          shortDeviceId: 'web-e2e',
          snapshot,
          previousBlobsToDelete: [],
        }),
      });
      const uploadText = await uploadRes.text();
      expect(uploadRes.status, uploadText.slice(0, 180)).toBe(200);
      const uploaded = JSON.parse(uploadText) as { pathname?: string };
      expect(uploaded.pathname).toBe('families/proxy-e2e/state-17000001000000-web.json');

      const latestRes = await fetch(
        `${origin}/api/sync/latest?familyCode=proxy-e2e`,
        { headers: { Accept: 'application/json' } }
      );
      const latestText = await latestRes.text();
      expect(latestRes.status, latestText.slice(0, 180)).toBe(200);
      const latest = JSON.parse(latestText) as {
        snapshot: {
          schemaVersion: number;
          familyCode: string;
          updatedAt: number;
          updatedByRole: string;
          updatedByDeviceId: string;
          parentPinCode: string;
          parentPinUpdatedAt: number;
          items: Array<{ id: string; weekday: number; title: string; category: string }>;
        };
      };

      expect(latest.snapshot.schemaVersion).toBe(5);
      expect(latest.snapshot.familyCode).toBe('proxy-e2e');
      expect(latest.snapshot.updatedByRole).toBe('👦 아이 웹');
      expect(latest.snapshot.updatedByDeviceId).toBe('web-e2e');
      expect(latest.snapshot.parentPinCode).toBe('160125');
      expect(latest.snapshot.items[0]).toMatchObject({
        id: '11111111-1111-4111-8111-111111111111',
        weekday: 1,
        title: EDITED_TITLE,
        category: 'study',
      });
    },
    40_000
  );

  it('proxies /api to http://localhost:3001 unless VITE_DEV_PROXY_TARGET is set', async () => {
    const previous = process.env.VITE_DEV_PROXY_TARGET;
    delete process.env.VITE_DEV_PROXY_TARGET;
    try {
      const viteEntry = path.join(webRoot, 'node_modules/vite/dist/node/index.js');
      const { loadConfigFromFile } = (await import(viteEntry)) as {
        loadConfigFromFile: (
          inline: { command: 'serve'; mode: string },
          configFile: string,
          configRoot?: string
        ) => Promise<{ config: { server?: { proxy?: Record<string, { target?: string }> } } } | null>;
      };
      const loaded = await loadConfigFromFile(
        { command: 'serve', mode: 'development' },
        path.join(webRoot, 'vite.config.ts'),
        webRoot
      );
      expect(loaded?.config.server?.proxy?.['/api']?.target).toBe('http://localhost:3001');
    } finally {
      if (previous === undefined) delete process.env.VITE_DEV_PROXY_TARGET;
      else process.env.VITE_DEV_PROXY_TARGET = previous;
    }
  });

  it(
    'npm run dev:all answers /api from the local proxy instead of the web page',
    async () => {
      const proxyPort = await freePort();
      const vitePort = await freePort();
      viteProcess = spawn('npm', ['run', 'dev:all'], {
        cwd: webRoot,
        detached: true,
        env: {
          ...process.env,
          PORT: String(proxyPort),
          VITE_DEV_PORT: String(vitePort),
          BLOB_READ_WRITE_TOKEN: '',
          BROWSER: 'none',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      await waitForLog(
        viteProcess,
        [
          new RegExp(`Listening on http://0\\.0\\.0\\.0:${proxyPort}`),
          new RegExp(`Local:\\s+http://(?:localhost|127\\.0\\.0\\.1):${vitePort}`),
        ],
        25_000
      );

      const latestRes = await fetch(
        `http://127.0.0.1:${vitePort}/api/sync/latest?familyCode=proxy-devall`,
        { headers: { Accept: 'application/json' } }
      );
      const latestText = await latestRes.text();
      expect(latestRes.status, latestText.slice(0, 180)).toBe(500);
      expect(latestText).toContain('BLOB_READ_WRITE_TOKEN');
      expect(latestText).not.toContain('<!doctype html');
    },
    40_000
  );
});
