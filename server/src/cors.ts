import cors from 'cors';

export const ALLOWED_ORIGINS = [
  'https://jaeheonk.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];

export function createCorsMiddleware() {
  const allowedSet = new Set(ALLOWED_ORIGINS);

  return cors({
    origin: (requestOrigin, callback) => {
      // Allow non-browser requests (e.g. curl, tests, server-to-server)
      if (!requestOrigin || allowedSet.has(requestOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
}
