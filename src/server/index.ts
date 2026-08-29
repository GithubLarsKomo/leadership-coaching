import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const here = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(process.env.DIST_DIR || join(here, '..', 'dist'));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon'
};

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 1_000_000) throw new Error('request_too_large');
    chunks.push(buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
function hash(value: unknown) { return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`; }
function requireDb() { if (!pool) throw new Error('database_not_configured'); return pool; }

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const rawPath = new URL(req.url || '/', 'http://localhost').pathname;
  const candidate = normalize(rawPath === '/' ? '/index.html' : rawPath).replace(/^([.][.][/\\])+/, '');
  let filePath = join(DIST_DIR, candidate);
  if (!filePath.startsWith(DIST_DIR)) return json(res, 400, { error: 'invalid_path' });
  if (!existsSync(filePath) || !statSync(filePath).isFile()) filePath = join(DIST_DIR, 'index.html');
  if (!existsSync(filePath)) return json(res, 503, { error: 'frontend_not_built' });
  const extension = extname(filePath);
  res.writeHead(200, {
    'Content-Type': mime[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  });
  createReadStream(filePath).pipe(res);
}

async function createSession(body: any) {
  const db = requireDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const def = await client.query(
      `SELECT v.id, v.scorecard_version_id, v.payload
       FROM assessment_definition d JOIN assessment_definition_version v ON v.assessment_definition_id=d.id
       WHERE d.definition_key=$1 AND v.status='published' ORDER BY v.created_at DESC LIMIT 1`, [body.definitionId]
    );
    if (!def.rowCount) throw new Error('definition_not_found');
    const definition = def.rows[0].payload;
    const firstRound = definition.rounds?.[0];
    if (!firstRound) throw new Error('definition_has_no_round');
    const session = await client.query(
      `INSERT INTO assessment_session(definition_version_id, scorecard_version_id, subject_ref, label, mode, owner_actor)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, started_at`,
      [def.rows[0].id, def.rows[0].scorecard_version_id, body.subjectRef || 'local-test', body.label || null, body.mode || 'baseline', 'local']
    );
    const round = await client.query(
      `INSERT INTO session_round(session_id, round_index, round_key, payload, source, reveal_on_unlock, time_limit_seconds)
       VALUES ($1,1,$2,$3::jsonb,'definition',$4,$5) RETURNING id, round_key, status, time_limit_seconds`,
      [session.rows[0].id, firstRound.id, JSON.stringify(firstRound), firstRound.delivery?.revealOnUnlock !== false, firstRound.delivery?.timeLimitSeconds ?? null]
    );
    await client.query(`INSERT INTO round_attempt(session_round_id, session_id, attempt_no) VALUES ($1,$2,1)`, [round.rows[0].id, session.rows[0].id]);
    await client.query('COMMIT');
    return { sessionId: session.rows[0].id, startedAt: session.rows[0].started_at, mode: body.mode || 'baseline', round: { roundId: round.rows[0].round_key, status: 'locked', timeLimitSeconds: round.rows[0].time_limit_seconds, title: firstRound.title } };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function getRound(sessionId: string, roundKey: string) {
  const db = requireDb();
  const result = await db.query(
    `SELECT r.id, r.round_key, r.status, r.payload, r.reveal_on_unlock, r.time_limit_seconds,
            a.id attempt_id, a.status attempt_status, a.unlocked_at, a.completed_at, a.elapsed_ms
     FROM session_round r LEFT JOIN LATERAL (SELECT * FROM round_attempt WHERE session_round_id=r.id ORDER BY attempt_no DESC LIMIT 1) a ON true
     WHERE r.session_id=$1 AND r.round_key=$2`, [sessionId, roundKey]
  );
  if (!result.rowCount) throw new Error('round_not_found');
  const row = result.rows[0];
  const hidden = row.reveal_on_unlock && row.attempt_status === 'locked';
  return {
    roundId: row.round_key, status: row.attempt_status, title: row.payload.title, purpose: row.payload.purpose,
    timeLimitSeconds: row.time_limit_seconds, unlockedAt: row.unlocked_at, completedAt: row.completed_at, elapsedMs: row.elapsed_ms,
    ...(hidden ? {} : { round: row.payload })
  };
}

async function unlockRound(sessionId: string, roundKey: string) {
  const db = requireDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT r.id, r.payload, r.time_limit_seconds, a.id attempt_id, a.status, a.unlocked_at
       FROM session_round r JOIN round_attempt a ON a.session_round_id=r.id
       WHERE r.session_id=$1 AND r.round_key=$2 ORDER BY a.attempt_no DESC LIMIT 1 FOR UPDATE OF a,r`, [sessionId, roundKey]
    );
    if (!result.rowCount) throw new Error('round_not_found');
    const row = result.rows[0];
    if (row.status === 'completed') throw new Error('attempt_completed');
    let unlockedAt = row.unlocked_at;
    if (row.status === 'locked') {
      const updated = await client.query(`UPDATE round_attempt SET status='active', unlocked_at=now() WHERE id=$1 RETURNING unlocked_at`, [row.attempt_id]);
      unlockedAt = updated.rows[0].unlocked_at;
      await client.query(`UPDATE session_round SET status='active' WHERE id=$1`, [row.id]);
      await client.query(`INSERT INTO audit_event(session_id,event_type,entity_type,entity_id,actor) VALUES ($1,'round.unlocked','round_attempt',$2,'local')`, [sessionId, row.attempt_id]);
    }
    await client.query('COMMIT');
    return { roundId: roundKey, status: 'active', unlockedAt, timeLimitSeconds: row.time_limit_seconds, round: row.payload };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function saveAnswers(sessionId: string, body: any) {
  const db = requireDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const attempt = await client.query(`SELECT id FROM round_attempt WHERE session_id=$1 AND status='active' ORDER BY unlocked_at DESC LIMIT 1 FOR UPDATE`, [sessionId]);
    if (!attempt.rowCount) throw new Error('no_active_attempt');
    const saved = [];
    for (const item of body.answers || []) {
      let answer = await client.query(`SELECT id FROM answer WHERE round_attempt_id=$1 AND question_key=$2`, [attempt.rows[0].id, item.questionId]);
      if (!answer.rowCount) answer = await client.query(`INSERT INTO answer(round_attempt_id,question_key) VALUES ($1,$2) RETURNING id`, [attempt.rows[0].id, item.questionId]);
      const latest = await client.query(`SELECT COALESCE(MAX(revision),0)::int + 1 revision FROM answer_version WHERE answer_id=$1`, [answer.rows[0].id]);
      await client.query(`INSERT INTO answer_version(answer_id,revision,value,actor) VALUES ($1,$2,$3::jsonb,'candidate')`, [answer.rows[0].id, latest.rows[0].revision, JSON.stringify(item.value)]);
      saved.push({ questionId: item.questionId, revision: latest.rows[0].revision });
    }
    await client.query('COMMIT');
    return { saved };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function completeRound(sessionId: string, roundKey: string) {
  const db = requireDb();
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT r.id round_id, r.round_index, r.round_key, r.payload, a.id attempt_id, a.attempt_no, a.unlocked_at
       FROM session_round r JOIN round_attempt a ON a.session_round_id=r.id
       WHERE r.session_id=$1 AND r.round_key=$2 AND a.status='active' FOR UPDATE OF a,r`, [sessionId, roundKey]
    );
    if (!result.rowCount) throw new Error('no_active_attempt');
    const row = result.rows[0];
    const answerRows = await client.query(
      `SELECT a.question_key, v.value, v.revision FROM answer a JOIN LATERAL (
         SELECT value, revision FROM answer_version WHERE answer_id=a.id ORDER BY revision DESC LIMIT 1
       ) v ON true WHERE a.round_attempt_id=$1`, [row.attempt_id]
    );
    const answers = Object.fromEntries(answerRows.rows.map((a) => [a.question_key, a.value]));
    const missing = (row.payload.questions || []).filter((q: any) => q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '')).map((q: any) => q.id);
    if (missing.length) throw new Error(`required_answers_missing:${missing.join(',')}`);
    const completed = await client.query(`UPDATE round_attempt SET status='completed', completed_at=now(), completed_by='candidate' WHERE id=$1 RETURNING completed_at, elapsed_ms`, [row.attempt_id]);
    await client.query(`UPDATE session_round SET status='completed' WHERE id=$1`, [row.round_id]);
    const handoff = {
      schemaVersion: '1.0', kind: 'leadership-round-handoff', sessionId,
      round: { roundIndex: row.round_index, roundId: row.round_key, attempt: row.attempt_no, title: row.payload.title, purpose: row.payload.purpose, competencies: row.payload.competencies || [], questions: row.payload.questions || [] },
      timing: { unlockedAt: row.unlocked_at, completedAt: completed.rows[0].completed_at, elapsedMs: Number(completed.rows[0].elapsed_ms), timeLimitMs: row.payload.delivery?.timeLimitSeconds ? row.payload.delivery.timeLimitSeconds * 1000 : null },
      answers
    };
    const contentHash = hash(handoff);
    await client.query(`INSERT INTO round_handoff(round_attempt_id,session_id,payload,content_hash) VALUES ($1,$2,$3::jsonb,$4)`, [row.attempt_id, sessionId, JSON.stringify(handoff), contentHash]);
    await client.query(`INSERT INTO audit_event(session_id,event_type,entity_type,entity_id,actor,payload) VALUES ($1,'round.completed','round_attempt',$2,'candidate',$3::jsonb)`, [sessionId, row.attempt_id, JSON.stringify({ contentHash })]);
    await client.query('COMMIT');
    return { handoff, contentHash };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/healthz') {
      let databaseReady = false;
      if (pool) { try { await pool.query('SELECT 1'); databaseReady = true; } catch { databaseReady = false; } }
      return json(res, databaseReady || !pool ? 200 : 503, { status: databaseReady || !pool ? 'ok' : 'degraded', service: 'leadership-coaching', database: { configured: Boolean(pool), ready: databaseReady }, now: new Date().toISOString() });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/version') return json(res, 200, { service: 'leadership-coaching', apiVersion: 'v1', appVersion: '0.2.0' });
    if (req.method === 'POST' && url.pathname === '/api/v1/sessions') return json(res, 201, await createSession(await readJson(req)));
    const roundMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/rounds\/([^/]+)$/i);
    if (req.method === 'GET' && roundMatch) return json(res, 200, await getRound(roundMatch[1], decodeURIComponent(roundMatch[2])));
    const unlockMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/rounds\/([^/]+)\/unlock$/i);
    if (req.method === 'POST' && unlockMatch) return json(res, 200, await unlockRound(unlockMatch[1], decodeURIComponent(unlockMatch[2])));
    const completeMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/rounds\/([^/]+)\/complete$/i);
    if (req.method === 'POST' && completeMatch) return json(res, 200, await completeRound(completeMatch[1], decodeURIComponent(completeMatch[2])));
    const answersMatch = url.pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/answers$/i);
    if (req.method === 'POST' && answersMatch) return json(res, 200, await saveAnswers(answersMatch[1], await readJson(req)));
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'api_route_not_found' });
    return serveStatic(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    const status = message.includes('not_found') ? 404 : message.startsWith('required_answers_missing') ? 422 : message.includes('configured') ? 503 : 409;
    return json(res, status, { error: message });
  }
});

server.listen(PORT, HOST, () => console.log(`Leadership Coaching listening on http://${HOST}:${PORT}`));
