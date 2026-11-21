import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    'DATABASE_URL is not configured. Copy backend/.env.example to backend/.env.',
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

export async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    if (error?.code === '23505') {
      error.status = 409;
    }

    throw error;
  }
}
