import express, { Express } from 'express';
import { createCorsMiddleware } from './cors.js';
import { handleHealthCheck } from './routes/health.js';
import { createSyncRouter } from './routes/sync.js';
import { SyncStorage } from './types.js';
import { resolveStorageFromEnv } from './storageFactory.js';

export interface AppOptions {
  /** 테스트·스크립트에서 저장소를 직접 넣는다. */
  storage?: SyncStorage;
  /** @deprecated storage를 쓴다. */
  blobStorage?: SyncStorage;
  /** 저장소를 고를 때 읽을 환경 변수. 기본은 process.env. */
  env?: NodeJS.ProcessEnv;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  // CORS middleware
  app.use(createCorsMiddleware());

  // JSON body parser with 5MB limit for rich snapshots
  app.use(express.json({ limit: '5mb' }));

  // Root healthcheck for container monitoring and uptime pings
  app.get('/health', handleHealthCheck);
  // Same healthcheck under /api for the single-origin Vercel deployment
  app.get('/api/health', handleHealthCheck);

  // Lazy or injected storage resolver
  // 주입된 저장소가 없으면 환경 변수로 한 번만 만들어 재사용한다.
  let resolved: SyncStorage | undefined;
  const getStorage = (): SyncStorage | undefined => {
    const injected = options.storage ?? options.blobStorage;
    if (injected) {
      return injected;
    }
    if (!resolved) {
      resolved = resolveStorageFromEnv(options.env ?? process.env);
    }
    return resolved;
  };

  // Mount sync router under /api/sync
  const syncRouter = createSyncRouter({ getStorage });
  app.use('/api/sync', syncRouter);

  return app;
}
