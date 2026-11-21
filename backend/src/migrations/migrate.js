import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { pool } from '../config/database.js';

const migrationsDirectory = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
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

  const lockClient = await pool.connect();

  try {
    await lockClient.query(
      'SELECT pg_advisory_lock(hashtext($1))',
      ['live-auction-migrations'],
    );

    const applied = await pool.query(
      'SELECT name, checksum FROM schema_migrations',
    );
    const appliedByName = new Map(
      applied.rows.map((row) => [row.name, row.checksum]),
    );

    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d+.*\.sql$/.test(file))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const previousChecksum = appliedByName.get(file);

      if (previousChecksum) {
        if (previousChecksum !== checksum) {
          throw new Error(`Migration checksum changed: ${file}`);
        }

        continue;
      }

      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (name, checksum)
           VALUES ($1, $2)`,
          [file, checksum],
        );
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(
      appliedCount === 0
        ? 'Database is already up to date.'
        : `Migrations complete (${appliedCount} applied).`,
    );
  } finally {
    await lockClient.query(
      'SELECT pg_advisory_unlock(hashtext($1))',
      ['live-auction-migrations'],
    );
    lockClient.release();
  }
}

migrate()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
