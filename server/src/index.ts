import 'dotenv/config';
import { createApp } from './app.js';
import { resolveStorageFromEnv } from './storageFactory.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = '0.0.0.0';
const app = createApp();

const server = app.listen(port, host, () => {
  console.log(`[WeeklySchedule Server] Listening on http://${host}:${port}`);
  if (!resolveStorageFromEnv(process.env)) {
    console.warn(
      '[WeeklySchedule Server] WARNING: sync storage is not configured (KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN). /api/sync endpoints will return 500.'
    );
  }
});

const gracefulShutdown = () => {
  console.log('[WeeklySchedule Server] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
