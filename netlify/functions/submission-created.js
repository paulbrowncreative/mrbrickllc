/* Emails every verified quote request to Mr. Brick.

   Netlify runs a function named `submission-created` automatically, server
   side, after each Netlify Forms submission passes spam filtering. Nothing
   here is visible to the visitor, and no address or key ships to the browser.

   Environment variables (Netlify > Site configuration > Environment variables):
     RESEND_API_KEY  required  API key from resend.com (free tier is plenty)
     LEAD_TO         optional  defaults to mrbrickdesignco@gmail.com
     LEAD_FROM       optional  defaults to "Mr. Brick Website <onboarding@resend.dev>"
                               (resend.dev can only send to the Resend account's
                               own email; verify mrbrickllc.com in Resend to send
                               from e.g. leads@mrbrickllc.com)

   Netlify Forms still stores every submission and its photos, so a lead is
   never lost even if the email provider is down. */

const LEAD_TO = process.env.LEAD_TO || 'mrbrickdesignco@gmail.com';
const LEAD_FROM = process.env.LEAD_FROM || 'Mr. Brick Website <onboarding@resend.dev>';

// Customer-facing fields first, in the order they appear on the form.
const FIELDS = [
  ['service', 'Service'], ['property_type', 'Property'], ['details', 'Project details'],
  ['zip', 'ZIP code'], ['timeframe', 'Timeframe'], ['name', 'Name'], ['phone', 'Phone'],
  ['email', 'Email'], ['contact_method', 'Preferred contact'], ['contact_time', 'Best time'],
];
const TRACKING = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid',
  'gbraid', 'wbraid', 'first_touch', 'last_touch', 'landing_page', 'referrer', 'submitted_from'];

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);

// Uploaded files arrive as {url, filename} objects (or an array of them).
function photoList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .filter((f) => f && typeof f === 'object' && f.url)
    .map((f) => ({ url: f.url, name: f.filename || 'photo' }));
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body).payload;
  } catch (err) {
    console.error('submission-created: unreadable payload');
    return { statusCode: 400, body: 'bad payload' };
  }
  if (!payload || payload.form_name !== 'quote') return { statusCode: 200, body: 'ignored' };

  const d = payload.data || {};
  if (d['bot-field']) return { statusCode: 200, body: 'spam' }; // honeypot

  if (!process.env.RESEND_API_KEY) {
    console.warn('submission-created: RESEND_API_KEY not set; lead stored in Netlify Forms only');
    return { statusCode: 200, body: 'no email provider configured' };
  }

  const photos = photoList(d.photos);
  const rows = FIELDS.filter(([k]) => d[k]).map(([k, label]) => [label, d[k]]);
  const tracking = TRACKING.filter((k) => d[k]).map((k) => [k, d[k]]);
  const phoneDigits = String(d.phone || '').replace(/[^\d+]/g, '');

  const subject = `New quote request: ${clean(d.service) || 'Masonry'} — ${clean(d.name) || 'website visitor'}` +
    (d.zip ? ` (${clean(d.zip)})` : '');

  const table = (list) => list.map(([k, v]) =>
    `<tr><th align="left" style="padding:6px 12px 6px 0;vertical-align:top;color:#50565c;font-weight:600">${esc(k)}</th>` +
    `<td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('');

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1f22;max-width:640px">
<h2 style="margin:0 0 4px;color:#b3222a">New quote request</h2>
<p style="margin:0 0 16px;color:#50565c">Submitted ${esc(new Date(payload.created_at || Date.now()).toLocaleString('en-US', { timeZone: 'America/Detroit' }))} from mrbrickllc.com</p>
${phoneDigits ? `<p style="margin:0 0 16px"><a href="tel:${esc(phoneDigits)}" style="background:#b3222a;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;font-weight:700">Call ${esc(d.phone)}</a>
&nbsp; <a href="sms:${esc(phoneDigits)}" style="color:#b3222a;font-weight:700">Text</a></p>` : ''}
<table cellspacing="0" cellpadding="0">${table(rows)}</table>
${photos.length ? `<h3 style="margin:20px 0 8px">Photos (${photos.length})</h3><ul>${photos.map((p) =>
    `<li><a href="${esc(p.url)}">${esc(p.name)}</a></li>`).join('')}</ul>
<p style="font-size:13px;color:#50565c">Photo links are also in Netlify &rarr; Forms &rarr; quote.</p>` : ''}
${tracking.length ? `<h3 style="margin:20px 0 8px;font-size:13px;color:#50565c">Lead source</h3>
<table cellspacing="0" cellpadding="0" style="font-size:13px">${table(tracking)}</table>` : ''}
</div>`;

  const text = [
    'New quote request from mrbrickllc.com', '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(photos.length ? ['', 'Photos:', ...photos.map((p) => p.url)] : []),
    ...(tracking.length ? ['', 'Lead source:', ...tracking.map(([k, v]) => `${k}: ${v}`)] : []),
  ].join('\n');

  const body = { from: LEAD_FROM, to: [LEAD_TO], subject, html, text };
  if (d.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) body.reply_to = clean(d.email);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('submission-created: email failed', res.status, (await res.text()).slice(0, 300));
      return { statusCode: 502, body: 'email failed' };
    }
  } catch (err) {
    console.error('submission-created: email error', err && err.message);
    return { statusCode: 502, body: 'email error' };
  }
  return { statusCode: 200, body: 'sent' };
};
