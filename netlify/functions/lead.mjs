/* POST /api/lead — quote form submissions, emailed through Resend.
   All logic lives in ../lib/lead.mjs; this file only adapts Netlify's
   Request/Response. Secrets are read here, on the server, and never reach
   the browser. Env vars: RESEND_API_KEY, LEAD_TO_EMAIL, RESEND_FROM_EMAIL
   (see .env.example and the README). */
import { handleLead, MAX_BODY_BYTES } from '../lib/lead.mjs';

export default async (req) => {
  const headers = Object.fromEntries([...req.headers].map(([k, v]) => [k.toLowerCase(), v]));
  // Don't buffer a body we're going to reject anyway.
  const declared = Number(headers['content-length'] || 0);
  const bodyText = req.method === 'POST' && declared <= MAX_BODY_BYTES ? await req.text() : '';

  const res = await handleLead({ method: req.method, headers, bodyText, env: process.env, fetch: globalThis.fetch });
  return new Response(res.body || null, { status: res.status, headers: res.headers });
};

export const config = { path: '/api/lead' };
