import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const here = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(process.env.DIST_DIR || join(here, '..', 'dist'));

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  res.end(payload);
}

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
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/healthz') {
    return json(res, 200, {
      status: 'ok',
      service: 'leadership-assessment-coaching',
      database: { configured: Boolean(process.env.DATABASE_URL) },
      now: new Date().toISOString()
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/v1/version') {
    return json(res, 200, { service: 'leadership-assessment-coaching', apiVersion: 'v1', appVersion: '0.1.0' });
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'api_route_not_implemented' });
  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => console.log(`Leadership Assessment Coaching listening on http://${HOST}:${PORT}`));
