import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString });
const dir = resolve('db/migrations');
const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();

await pool.query(`CREATE TABLE IF NOT EXISTS schema_migration (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`);

for (const filename of files) {
  const exists = await pool.query('SELECT 1 FROM schema_migration WHERE filename = $1', [filename]);
  if (exists.rowCount) continue;
  const sql = await readFile(resolve(dir, filename), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migration(filename) VALUES ($1)', [filename]);
    console.log(`applied ${filename}`);
  } finally {
    client.release();
  }
}

await pool.end();
