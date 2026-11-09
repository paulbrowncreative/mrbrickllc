/* Quote form → Resend email. Plain functions, no globals: the Netlify
   function (netlify/functions/lead.mjs) passes in the request, env and fetch,
   so tests can run the whole flow without a network.

   Flow: size check → parse (form-encoded or JSON) → sanitize → spam check
   (fake success) → validate (422) → Resend (502 on any failure) → success.
   Browsers with JS send Accept: application/json and get JSON back; plain
   HTML form posts get a 303 to /thank-you or /form-error. */

export const MAX_BODY_BYTES = 20 * 1024;
export const MIN_FILL_MS = 2500;
export const MAX_LINKS = 2;
export const RESEND_URL = 'https://api.resend.com/emails';

export const BUSINESS = {
  name: 'Mr. Brick LLC',
  phone: '(586) 209-3052',
  phoneE164: '+15862093052',
  site: 'https://www.mrbrickllc.com',
  timeZone: 'America/Detroit',
  brand: '#b3222a',
  ink: '#1d1f22',
};

export const PAGES = { success: '/thank-you', error: '/form-error' };

// Every field the form may send, with its length cap. Anything else is ignored.
// multiline: keep line breaks (everything else is collapsed to one line).
const FIELDS = {
  service: { max: 40, label: 'Service' },
  property_type: { max: 20, label: 'Property type' },
  details: { max: 2000, label: 'Project details', multiline: true },
  zip: { max: 10, label: 'Project ZIP' },
  timeframe: { max: 40, label: 'Timeframe' },
  name: { max: 80, label: 'Name' },
  phone: { max: 25, label: 'Phone' },
  email: { max: 120, label: 'Email' },
  contact_method: { max: 10, label: 'Best way to reach' },
  contact_time: { max: 20, label: 'Best time' },
  // tracking
  page_url: { max: 500, label: 'Submitted from' },
  landing_page: { max: 300, label: 'First landing page' },
  referrer: { max: 300, label: 'Referrer' },
  first_touch: { max: 600, label: 'First touch' },
  last_touch: { max: 600, label: 'Last touch' },
  utm_source: { max: 150, label: 'utm_source' },
  utm_medium: { max: 150, label: 'utm_medium' },
  utm_campaign: { max: 150, label: 'utm_campaign' },
  utm_term: { max: 150, label: 'utm_term' },
  utm_content: { max: 150, label: 'utm_content' },
  gclid: { max: 200, label: 'gclid' },
  gbraid: { max: 200, label: 'gbraid' },
  wbraid: { max: 200, label: 'wbraid' },
  // spam traps
  'bot-field': { max: 200 },
  started_at: { max: 20 },
};
const PROJECT_FIELDS = ['service', 'property_type', 'timeframe', 'zip', 'details'];
const CONTACT_FIELDS = ['name', 'phone', 'email', 'contact_method', 'contact_time'];
const TRACKING_FIELDS = ['page_url', 'landing_page', 'referrer', 'first_touch', 'last_touch',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'];

// Same wording as the browser messages in static/js/site.js.
export const MESSAGES = {
  service: 'Choose the closest service, or pick Other.',
  property_type: 'Choose a property type.',
  zip: 'Enter the ZIP code where the work is.',
  zipFormat: 'Enter a 5-digit ZIP code.',
  name: 'Enter your name.',
  phone: 'Enter a phone number so we can reach you.',
  phoneFormat: 'Enter a 10-digit phone number.',
  emailNeeded: 'Enter your email, since you prefer to be contacted by email.',
  emailFormat: 'Enter an email like name@example.com.',
};

/* ---------------------------------------------------------------- parsing */

export function parseBody(text, contentType = '') {
  if (/application\/json/i.test(contentType)) {
    const obj = JSON.parse(text || '{}');
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON body must be an object');
    return obj;
  }
  return Object.fromEntries(new URLSearchParams(text || ''));
}

// Control characters out, length capped, whitespace trimmed. Single-line fields
// also lose line breaks so nothing can break a subject line or table row.
export function cleanValue(value, { max = 200, multiline = false } = {}) {
  let s = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  s = s.replace(/\r\n?/g, '\n');
  s = multiline
    ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, '').replace(/\n{3,}/g, '\n\n')
    : s.replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ');
  return s.trim().slice(0, max).trim();
}

export function sanitize(raw) {
  const out = {};
  for (const [key, spec] of Object.entries(FIELDS)) out[key] = cleanValue(raw[key], spec);
  return out;
}

/* ------------------------------------------------------------------- spam */

export function countLinks(text) {
  return (String(text).match(/https?:\/\/|www\./gi) || []).length;
}

// Returns the reason (for logs) or '' when the lead looks human.
export function spamReason(lead, now = Date.now()) {
  if (lead['bot-field']) return 'honeypot';
  // started_at is set by site.js. Without JS it's blank and the timing check is skipped.
  const started = Number(lead.started_at);
  if (lead.started_at && Number.isFinite(started) && now - started < MIN_FILL_MS) return 'too-fast';
  const text = [lead.name, lead.details, lead.email, lead.zip].join(' ');
  if (countLinks(text) > MAX_LINKS) return 'links';
  return '';
}

/* ------------------------------------------------------------- validation */

export function validate(lead) {
  const errors = {};
  if (!lead.service) errors.service = MESSAGES.service;
  if (!lead.property_type) errors.property_type = MESSAGES.property_type;
  if (!lead.zip) errors.zip = MESSAGES.zip;
  else if (!/^\d{5}$/.test(lead.zip)) errors.zip = MESSAGES.zipFormat;
  if (!lead.name) errors.name = MESSAGES.name;
  const digits = lead.phone.replace(/\D/g, '');
  if (!lead.phone) errors.phone = MESSAGES.phone;
  else if (digits.length < 10 || digits.length > 15) errors.phone = MESSAGES.phoneFormat;
  if (!lead.email && lead.contact_method === 'Email') errors.email = MESSAGES.emailNeeded;
  else if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.email = MESSAGES.emailFormat;
  return errors;
}

/* ------------------------------------------------------------------ email */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function telHref(phone) {
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;
  return 'tel:+' + d;
}

export function formatWhen(now, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(now));
}

export function buildEmail(lead, { business = BUSINESS, now = Date.now() } = {}) {
  const when = formatWhen(now, business.timeZone);
  const subject = cleanValue(`New quote request: ${lead.name} — ${lead.service} · ${lead.zip}`, { max: 200 });
  const rows = (keys) => keys.filter((k) => lead[k]).map((k) => [FIELDS[k].label, lead[k]]);
  const project = rows(PROJECT_FIELDS);
  const contact = rows(CONTACT_FIELDS);
  const tracking = rows(TRACKING_FIELDS);

  const td = 'padding:8px 12px;border-bottom:1px solid #e6e2dc;vertical-align:top;font-size:15px;line-height:1.45;word-break:break-word;overflow-wrap:anywhere;';
  const table = (list) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed;">${list
    .map(([k, v]) => `<tr><th align="left" style="${td}width:38%;color:#5b6066;font-weight:600;">${escapeHtml(k)}</th><td style="${td}color:${business.ink};">${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')}</table>`;
  const h2 = (t) => `<h2 style="margin:24px 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5b6066;">${t}</h2>`;
  const btn = (href, label, bg) => `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:6px;background:${bg};color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;">${escapeHtml(label)}</a>`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ec;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${business.ink};">
<div style="background:${business.ink};color:#ffffff;padding:16px 20px;border-radius:8px 8px 0 0;border-bottom:4px solid ${business.brand};">
<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">${escapeHtml(business.name)} website</div>
<div style="font-size:22px;font-weight:800;margin-top:4px;">New quote request</div></div>
<div style="background:#ffffff;padding:20px;border-radius:0 0 8px 8px;">
<p style="margin:0 0 4px;font-size:20px;font-weight:700;">${escapeHtml(lead.name)}</p>
<p style="margin:0 0 16px;color:#5b6066;">${escapeHtml(lead.service)} · ${escapeHtml(lead.property_type)} · ZIP ${escapeHtml(lead.zip)}<br>Received ${escapeHtml(when)}</p>
${btn(telHref(lead.phone), `Call ${lead.phone}`, business.brand)}${lead.email ? btn(`mailto:${lead.email}`, 'Reply by email', '#30343a') : ''}
${h2('Project')}${table(project)}
${h2('Contact')}${table(contact)}
${tracking.length ? h2('Source &amp; tracking') + table(tracking) : ''}
<p style="margin:24px 0 0;font-size:13px;color:#5b6066;">Sent by the quote form on ${escapeHtml(business.site.replace(/^https?:\/\//, ''))}.${lead.email ? ' Replying to this email goes to the customer.' : ''}</p>
</div></div></body></html>`;

  const lines = (list) => list.map(([k, v]) => `${k}: ${v}`).join('\n');
  const text = [
    `New quote request — ${business.name} website`,
    `Received ${when}`,
    '',
    `${lead.name} · ${lead.phone}${lead.email ? ' · ' + lead.email : ''}`,
    `Call: ${telHref(lead.phone)}`,
    '',
    'PROJECT', lines(project), '',
    'CONTACT', lines(contact),
    ...(tracking.length ? ['', 'SOURCE & TRACKING', lines(tracking)] : []),
  ].join('\n');

  return { subject, html, text };
}

export function recipients(list) {
  return String(list || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export async function sendWithResend(lead, { env, fetch, now = Date.now(), business = BUSINESS }) {
  const to = recipients(env.LEAD_TO_EMAIL);
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !to.length) {
    return { ok: false, error: 'Missing RESEND_API_KEY, RESEND_FROM_EMAIL or LEAD_TO_EMAIL' };
  }
  const { subject, html, text } = buildEmail(lead, { business, now });
  const payload = { from: env.RESEND_FROM_EMAIL, to, subject, html, text };
  if (lead.email) payload.reply_to = lead.email;
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Resend request failed: ${err.message}` };
  }
}

/* ---------------------------------------------------------------- handler */

function reply(wantsJson, status, json, redirectTo) {
  const base = { 'Cache-Control': 'no-store' };
  if (wantsJson) {
    return { status, headers: { ...base, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(json) };
  }
  return { status: 303, headers: { ...base, Location: redirectTo }, body: '' };
}

/* headers: plain object with lower-case keys. Returns { status, headers, body }. */
export async function handleLead({ method, headers = {}, bodyText = '', env = {}, fetch, now = Date.now(), log = console }) {
  const wantsJson = /application\/json/i.test(headers.accept || '');
  if (method !== 'POST') {
    return { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }
  if (Number(headers['content-length'] || 0) > MAX_BODY_BYTES || Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
    return reply(wantsJson, 413, { ok: false, error: 'too_large' }, PAGES.error);
  }

  let raw;
  try { raw = parseBody(bodyText, headers['content-type']); } catch {
    return reply(wantsJson, 400, { ok: false, error: 'bad_request' }, PAGES.error);
  }
  const lead = sanitize(raw);

  const spam = spamReason(lead, now);
  if (spam) {
    log.info?.(`lead: dropped as spam (${spam})`);
    return reply(wantsJson, 200, { ok: true }, PAGES.success); // fake success, nothing sent
  }

  const errors = validate(lead);
  if (Object.keys(errors).length) return reply(wantsJson, 422, { ok: false, errors }, PAGES.error);

  const sent = await sendWithResend(lead, { env, fetch, now });
  if (!sent.ok) {
    log.error?.(`lead: email not sent — ${sent.error}`);
    return reply(wantsJson, 502, { ok: false, error: 'send_failed' }, PAGES.error);
  }
  return reply(wantsJson, 200, { ok: true }, PAGES.success);
}
