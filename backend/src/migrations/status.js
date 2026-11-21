import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const migrationsDirectory = path.dirname(fileURLToPath(import.meta.url));

async function status() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not configured. Copy backend/.env.example to backend/.env.',
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();
  const applied = await pool.query(
    'SELECT name, applied_at FROM schema_migrations ORDER BY name',
  );
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  for (const file of files) {
    const record = applied.rows.find((row) => row.name === file);
    console.log(
      `${appliedNames.has(file) ? 'Applied' : 'Pending'}  ${file}${
        record ? `  (${record.applied_at.toISOString()})` : ''
      }`,
    );
  }
}

status()
  .catch((error) => {
    console.error('Could not read migration status:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
