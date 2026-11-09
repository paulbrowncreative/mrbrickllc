// Unit tests for netlify/lib/lead.mjs. No network: Resend is a fake fetch.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleLead, buildEmail, sanitize, cleanValue, spamReason, validate, escapeHtml,
  RESEND_URL, MAX_BODY_BYTES, MESSAGES,
} from '../netlify/lib/lead.mjs';

const NOW = Date.parse('2026-11-09T15:30:00Z');
const ENV = {
  RESEND_API_KEY: 're_test_key',
  LEAD_TO_EMAIL: 'owner@example.com, office@example.com',
  RESEND_FROM_EMAIL: 'Mr. Brick Website <leads@mrbrickllc.com>',
};
const quiet = { info() {}, error() {} };

function fakeFetch(status = 200, body = '{"id":"email_123"}') {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, json: JSON.parse(opts.body) });
    return { ok: status >= 200 && status < 300, status, text: async () => body };
  };
  fn.calls = calls;
  return fn;
}

const VALID = {
  service: 'Chimney', property_type: 'Residential', zip: '48021', timeframe: 'As soon as possible',
  details: 'Crown is cracked.\nMortar missing at the top.', name: 'Pat Smith', phone: '(586) 555-0123',
  email: 'pat@example.com', contact_method: 'Call', contact_time: 'Anytime',
  page_url: 'https://www.mrbrickllc.com/chimney-repair', landing_page: '/chimney-repair',
  referrer: 'https://www.google.com/', utm_source: 'google', utm_medium: 'cpc', gclid: 'abc123',
  'bot-field': '', started_at: String(NOW - 60_000),
};
const form = (o) => new URLSearchParams(o).toString();
const call = (over = {}) => handleLead({
  method: 'POST', env: ENV, now: NOW, log: quiet,
  headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
  bodyText: form(VALID), ...over,
});

test('valid lead sends one email through Resend and returns JSON ok', async () => {
  const fetch = fakeFetch();
  const res = await call({ fetch });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
  assert.equal(fetch.calls.length, 1);
  const { url, opts, json } = fetch.calls[0];
  assert.equal(url, RESEND_URL);
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers.Authorization, 'Bearer re_test_key');
  assert.equal(json.from, ENV.RESEND_FROM_EMAIL);
  assert.deepEqual(json.to, ['owner@example.com', 'office@example.com']);
  assert.equal(json.reply_to, 'pat@example.com');
  assert.equal(json.subject, 'New quote request: Pat Smith — Chimney · 48021');
  assert.match(json.html, /href="tel:\+15865550123"/);
  assert.match(json.html, /Mon, Nov 9, 2026, 10:30 AM EST/); // client time zone (America/Detroit)
  assert.match(json.html, /Source &amp; tracking/);
  assert.match(json.html, /gclid/);
  assert.match(json.text, /Crown is cracked\.\nMortar missing/);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('JSON request bodies are accepted too', async () => {
  const fetch = fakeFetch();
  const res = await call({ fetch, headers: { accept: 'application/json', 'content-type': 'application/json' }, bodyText: JSON.stringify(VALID) });
  assert.equal(res.status, 200);
  assert.equal(fetch.calls.length, 1);
});

test('no reply_to when the customer leaves email blank', async () => {
  const fetch = fakeFetch();
  await call({ fetch, bodyText: form({ ...VALID, email: '' }) });
  assert.equal('reply_to' in fetch.calls[0].json, false);
});

test('missing required fields return 422 with an error per field and send nothing', async () => {
  const fetch = fakeFetch();
  const res = await call({ fetch, bodyText: form({ ...VALID, name: '', phone: '', zip: '', service: '', property_type: '' }) });
  assert.equal(res.status, 422);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, false);
  assert.deepEqual(Object.keys(body.errors).sort(), ['name', 'phone', 'property_type', 'service', 'zip']);
  assert.equal(body.errors.name, MESSAGES.name);
  assert.equal(fetch.calls.length, 0);
});

test('format rules match the browser: ZIP, phone, email, email-when-preferred', () => {
  const lead = sanitize({ ...VALID, zip: '4802', phone: '555-0123', email: 'not-an-email' });
  assert.deepEqual(validate(lead), { zip: MESSAGES.zipFormat, phone: MESSAGES.phoneFormat, email: MESSAGES.emailFormat });
  assert.deepEqual(validate(sanitize({ ...VALID, email: '', contact_method: 'Email' })), { email: MESSAGES.emailNeeded });
});

test('spam is dropped with a fake success: honeypot, too fast, too many links', async () => {
  for (const extra of [
    { 'bot-field': 'http://spam.example' },
    { started_at: String(NOW - 1200) },
    { details: 'see https://a.example https://b.example www.c.example' },
  ]) {
    const fetch = fakeFetch();
    const res = await call({ fetch, bodyText: form({ ...VALID, ...extra }) });
    assert.equal(res.status, 200, JSON.stringify(extra));
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    assert.equal(fetch.calls.length, 0, 'nothing sent for ' + JSON.stringify(extra));
  }
  // No-JS spam also gets the success redirect.
  const fetch = fakeFetch();
  const res = await call({ fetch, headers: { 'content-type': 'application/x-www-form-urlencoded' }, bodyText: form({ ...VALID, 'bot-field': 'x' }) });
  assert.equal(res.status, 303);
  assert.equal(res.headers.Location, '/thank-you');
  assert.equal(fetch.calls.length, 0);
});

test('blank started_at (JavaScript off) skips only the timing check', () => {
  assert.equal(spamReason(sanitize({ ...VALID, started_at: '' }), NOW), '');
  assert.equal(spamReason(sanitize({ ...VALID, details: 'two links http://a.example http://b.example' }), NOW), '');
});

test('requests without JavaScript get 303 redirects', async () => {
  const headers = { accept: 'text/html,application/xhtml+xml', 'content-type': 'application/x-www-form-urlencoded' };
  const ok = await call({ fetch: fakeFetch(), headers, bodyText: form({ ...VALID, started_at: '' }) });
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.Location, '/thank-you');
  assert.equal(ok.body, '');
  const bad = await call({ fetch: fakeFetch(), headers, bodyText: form({ ...VALID, phone: '' }) });
  assert.equal(bad.status, 303);
  assert.equal(bad.headers.Location, '/form-error');
  const down = await call({ fetch: fakeFetch(500), headers, bodyText: form(VALID) });
  assert.equal(down.status, 303);
  assert.equal(down.headers.Location, '/form-error');
});

test('Resend error returns 502', async () => {
  const fetch = fakeFetch(422, '{"message":"The leads@mrbrickllc.com domain is not verified"}');
  const errors = [];
  const res = await call({ fetch, log: { info() {}, error: (m) => errors.push(m) } });
  assert.equal(res.status, 502);
  assert.deepEqual(JSON.parse(res.body), { ok: false, error: 'send_failed' });
  assert.match(errors[0], /Resend 422: .*not verified/);
});

test('network failure reaching Resend returns 502', async () => {
  const res = await call({ fetch: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(res.status, 502);
});

test('missing RESEND_API_KEY returns 502 and never calls fetch', async () => {
  const fetch = fakeFetch();
  const res = await call({ fetch, env: { ...ENV, RESEND_API_KEY: '' } });
  assert.equal(res.status, 502);
  assert.equal(fetch.calls.length, 0);
});

test('every value is HTML-escaped in the email', async () => {
  const fetch = fakeFetch();
  const evil = '<script>alert("x")</script>';
  await call({ fetch, bodyText: form({ ...VALID, name: `Bob ${evil}`, details: `<img src=x onerror=alert(1)> & "quotes"`, utm_campaign: evil }) });
  const { html, subject } = fetch.calls[0].json;
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /Bob &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;quotes&quot;/);
  assert.match(subject, /^New quote request: Bob <script>/); // subject is plain text, not HTML
  assert.equal(escapeHtml(`<a href='x'>&`), '&lt;a href=&#39;x&#39;&gt;&amp;');
});

test('values are trimmed, capped and stripped of control characters', () => {
  assert.equal(cleanValue('  Pat\u0000 Smith\r\n  ', { max: 80 }), 'Pat Smith');
  assert.equal(cleanValue('line1\r\nline2\u0007', { max: 100, multiline: true }), 'line1\nline2');
  assert.equal(cleanValue('x'.repeat(500), { max: 80 }).length, 80);
  const lead = sanitize({ name: 'A\nB', unknown_field: 'dropped' });
  assert.equal(lead.name, 'A B');
  assert.equal('unknown_field' in lead, false);
});

test('requests over 20KB are rejected before parsing', async () => {
  const fetch = fakeFetch();
  const big = form({ ...VALID, details: 'x'.repeat(MAX_BODY_BYTES) });
  const res = await call({ fetch, bodyText: big });
  assert.equal(res.status, 413);
  assert.equal(fetch.calls.length, 0);
  const declared = await call({ fetch, headers: { accept: 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) }, bodyText: '' });
  assert.equal(declared.status, 413);
});

test('only POST is allowed; malformed JSON is a 400', async () => {
  const get = await call({ method: 'GET', fetch: fakeFetch() });
  assert.equal(get.status, 405);
  assert.equal(get.headers.Allow, 'POST');
  const bad = await call({ fetch: fakeFetch(), headers: { accept: 'application/json', 'content-type': 'application/json' }, bodyText: '{nope' });
  assert.equal(bad.status, 400);
});

test('subject and text stay on one line per field even with injected newlines', () => {
  const { subject } = buildEmail(sanitize({ ...VALID, name: 'Pat\r\nBcc: x@example.com' }), { now: NOW });
  assert.equal(subject.includes('\n'), false);
});
