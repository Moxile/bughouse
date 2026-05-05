import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { ConnectionManager } from './net/ConnectionManager.js';

const PORT = Number(process.env.PORT ?? 3000);
// When run via npm workspace scripts, cwd = the server package directory.
// CLIENT_DIST env var overrides for custom deployments.
const CLIENT_DIST = process.env.CLIENT_DIST
  ?? resolve(process.cwd(), '../client/dist');

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function serveFile(path: string, res: import('node:http').ServerResponse): void {
  try {
    const data = readFileSync(path);
    const ext = extname(path);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    // File not found → serve index.html (SPA fallback).
    try {
      const data = readFileSync(join(CLIENT_DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

const cm = new ConnectionManager();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/games') {
    const code = cm.createRoom();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code }));
    return;
  }

  // Static files.
  const filePath = url.pathname === '/'
    ? join(CLIENT_DIST, 'index.html')
    : join(CLIENT_DIST, url.pathname);
  serveFile(filePath, res);
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => cm.handleConnection(ws));

server.listen(PORT, () => {
  console.log(`Bughouse server running on http://localhost:${PORT}`);
});
