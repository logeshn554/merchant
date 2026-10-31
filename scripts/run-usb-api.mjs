import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const origPool = pg.Pool;
pg.Pool = function (poolConfig) {
  if (poolConfig && poolConfig.connectionString && poolConfig.connectionString.includes('neon.tech')) {
    poolConfig = {
      ...poolConfig,
      connectionString: poolConfig.connectionString.replace(/@[^/]+/, '@52.14.39.200').replace(/sslmode=[^&]+/, 'sslmode=no-verify') + '&options=endpoint%3Dep-winter-forest-b4uja7sw',
      ssl: { rejectUnauthorized: false }
    };
  }
  return new origPool(poolConfig);
};

// Local USB development uses the existing account database without copying credentials.
config({ path: fileURLToPath(new URL('../../delivery123/.env.local', import.meta.url)), quiet: true });
process.env.ACCOUNT_API_PORT = '3005';
process.env.ACCOUNT_API_HOST = '127.0.0.1';
process.env.ACCOUNT_TEST_SCHEMA = 'allgo_usb_merchant';
await import('../server/accounts.mjs');


