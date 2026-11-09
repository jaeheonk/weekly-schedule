import express, { Express } from 'express';
import { createCorsMiddleware } from './cors.js';
import { handleHealthCheck } from './routes/health.js';
import { createSyncRouter } from './routes/sync.js';
import { BlobStorage } from './types.js';
import { VercelBlobStorage } from './blobStorage.js';

export interface AppOptions {
  blobToken?: string;
  blobStorage?: BlobStorage;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  // CORS middleware
  app.use(createCorsMiddleware());

  // JSON body parser with 5MB limit for rich snapshots
  app.use(express.json({ limit: '5mb' }));

  // Healthcheck
  app.get('/health', handleHealthCheck);

  // Lazy or injected storage resolver
  const getStorage = (): BlobStorage | undefined => {
    if (options.blobStorage) {
      return options.blobStorage;
    }
    const token = options.blobToken !== undefined ? options.blobToken : process.env.BLOB_READ_WRITE_TOKEN;
    if (!token || !token.trim()) {
      return undefined;
    }
    return new VercelBlobStorage(token);
  };

  const syncRouter = createSyncRouter({ getStorage });

  app.get('/api/sync/latest', syncRouter.requireStorage, syncRouter.getLatest);
  app.post('/api/sync/upload', syncRouter.requireStorage, syncRouter.uploadSnapshot);

  return app;
}
