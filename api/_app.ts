// Shared Express app for the Vercel Functions under /api.
// Each route file re-exports the same app, so req.url keeps the real path
// (/api/sync/latest, /api/sync/upload, ...) and the Express router in
// server/src handles it exactly like the Render server did.
import { createApp } from '../server/src/app.js';

const app = createApp();

export default app;
