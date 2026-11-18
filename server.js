import app from './app.js';
import { testConnection } from './config/db.js';

const PORT = Number(process.env.PORT || 4000);

const start = async () => {
  const database = await testConnection();

  if (database.connected) {
    console.log(`[db] ${database.message}`);
  } else {
    // The API still starts so the health endpoint can report the problem
    // instead of the process terminating on a failed connection.
    console.warn(`[db] ${database.message}`);
  }

  app.listen(PORT, () => {
    console.log(`[api] Batloung Farm Distribution API listening on port ${PORT}`);
    console.log(`[api] Health check: http://localhost:${PORT}/api/health`);
  });
};

// Never let an unexpected rejection terminate the process silently.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[uncaughtException]', error);
});

start();
