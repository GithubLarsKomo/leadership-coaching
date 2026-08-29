import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
function hash(value: unknown) {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
}

const scorecard = JSON.parse(await readFile('assessments/pes-sgl-sh/scorecard.json', 'utf8'));
const definition = JSON.parse(await readFile('assessments/pes-sgl-sh/definition.json', 'utf8'));
const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  const scorecardRoot = await client.query(
    `INSERT INTO scorecard(scorecard_key) VALUES ($1)
     ON CONFLICT(scorecard_key) DO UPDATE SET scorecard_key = EXCLUDED.scorecard_key
     RETURNING id`, [scorecard.scorecardId]
  );
  const scorecardVersion = await client.query(
    `INSERT INTO scorecard_version(scorecard_id, version, payload, content_hash, status, created_by)
     VALUES ($1,$2,$3::jsonb,$4,'published','seed')
     ON CONFLICT(scorecard_id, version) DO UPDATE SET payload=EXCLUDED.payload, content_hash=EXCLUDED.content_hash, status='published'
     RETURNING id`,
    [scorecardRoot.rows[0].id, scorecard.version, JSON.stringify(scorecard), hash(scorecard)]
  );
  const definitionRoot = await client.query(
    `INSERT INTO assessment_definition(definition_key) VALUES ($1)
     ON CONFLICT(definition_key) DO UPDATE SET definition_key = EXCLUDED.definition_key
     RETURNING id`, [definition.definitionId]
  );
  await client.query(
    `INSERT INTO assessment_definition_version(assessment_definition_id, version, scorecard_version_id, payload, content_hash, status, created_by)
     VALUES ($1,$2,$3,$4::jsonb,$5,'published','seed')
     ON CONFLICT(assessment_definition_id, version) DO UPDATE SET scorecard_version_id=EXCLUDED.scorecard_version_id, payload=EXCLUDED.payload, content_hash=EXCLUDED.content_hash, status='published'`,
    [definitionRoot.rows[0].id, definition.version, scorecardVersion.rows[0].id, JSON.stringify(definition), hash(definition)]
  );
  await client.query('COMMIT');
  console.log('seeded pes-sgl-sh');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
