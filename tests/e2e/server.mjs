// Local stand-in for Netlify in end-to-end tests: serves dist/ with pretty
// URLs and routes POST /api/lead through the real handler, with Resend
// replaced by a fake HTTP endpoint that records every email it receives.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleLead, RESEND_URL, MAX_BODY_BYTES } from '../../netlify/lib/lead.mjs';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

export async function startFakeResend() {
  const state = { emails: [], failWith: 0 };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (state.failWith) {
        res.writeHead(state.failWith, { 'Content-Type': 'application/json' });
        return res.end('{"message":"fake Resend failure"}');
      }
      state.emails.push({ auth: req.headers.authorization, json: JSON.parse(body) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `email_${state.emails.length}` }));
    });
  });
  const url = await listen(server);
  return { url, state, close: () => server.close() };
}

async function serveFile(res, file, status = 200) {
  const data = await readFile(file);
  res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(data);
}

async function resolveStatic(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\/+$/, '') || '/';
  const candidates = clean === '/' ? ['index.html'] : [clean.slice(1), clean.slice(1) + '.html'];
  for (const c of candidates) {
    const file = path.join(DIST, c);
    if (!file.startsWith(DIST)) return null;
    try { if ((await stat(file)).isFile()) return file; } catch { /* next */ }
  }
  return null;
}

export async function startSite({ resendUrl, env }) {
  // Real handler, real HTTP to the fake Resend: only the hostname changes.
  const fetchToFake = (url, opts) => {
    if (url !== RESEND_URL) throw new Error(`unexpected fetch ${url}`);
    return fetch(`${resendUrl}/emails`, opts);
  };
  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    if (pathname === '/api/lead') {
      let body = '';
      let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size <= MAX_BODY_BYTES + 1) body += chunk; }
      const out = await handleLead({ method: req.method, headers: req.headers, bodyText: body, env, fetch: fetchToFake, log: { info() {}, error() {} } });
      res.writeHead(out.status, out.headers);
      return res.end(out.body);
    }
    const file = await resolveStatic(pathname);
    if (file) return serveFile(res, file);
    return serveFile(res, path.join(DIST, '404.html'), 404);
  });
  const url = await listen(server);
  return { url, close: () => server.close() };
}
