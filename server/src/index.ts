import 'dotenv/config';
import { createApp } from './app.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = '0.0.0.0';
const app = createApp();

const server = app.listen(port, host, () => {
  console.log(`[WeeklySchedule Server] Listening on http://${host}:${port}`);
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      '[WeeklySchedule Server] WARNING: BLOB_READ_WRITE_TOKEN is not set. /api/sync endpoints will return 500.'
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
