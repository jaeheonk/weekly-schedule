import cors from 'cors';

export const ALLOWED_ORIGINS: (string | RegExp)[] = [
  'https://jaeheonk.github.io',
  /^https:\/\/jaeheonk\.github\.io/,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

export function createCorsMiddleware() {
  const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const origins = [...ALLOWED_ORIGINS, ...extraOrigins];

  return cors({
    origin: (requestOrigin, callback) => {
      // Allow non-browser requests (e.g. curl, tests, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }

      const isAllowed = origins.some((allowed) => {
        if (typeof allowed === 'string') {
          return allowed === requestOrigin;
        }
        return allowed.test(requestOrigin);
      });

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-family-code', 'x-device-id'],
    credentials: true,
  });
}
