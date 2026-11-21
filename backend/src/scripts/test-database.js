import 'dotenv/config';
import { pool } from '../config/database.js';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not configured. Copy backend/.env.example to backend/.env.',
  );
  await pool.end();
  process.exit(1);
}

try {
  const result = await pool.query(`
    SELECT
      NOW() AS server_time,
      current_database() AS database_name,
      current_user AS database_user,
      version() AS server_version
  `);

  console.log('PostgreSQL connection successful');
  console.log(result.rows[0]);
} catch (error) {
  console.error('PostgreSQL connection failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
