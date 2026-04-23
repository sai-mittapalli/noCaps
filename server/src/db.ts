import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('[db] DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] unexpected pool error', err);
});

export default pool;
