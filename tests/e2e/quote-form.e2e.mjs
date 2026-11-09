// End-to-end quote form test: real browser, real /api/lead handler, fake Resend.
// Run: python3 build.py && node --test tests/e2e/
// Needs Playwright with Chromium (and optionally axe-core) importable from Node.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startFakeResend, startSite } from './server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
let axeSource = null;
try { axeSource = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { /* optional */ }

const ENV = { RESEND_API_KEY: 're_e2e', LEAD_TO_EMAIL: 'leads@example.com, owner@example.com', RESEND_FROM_EMAIL: 'Mr. Brick Website <leads@mrbrickllc.com>' };
const MOBILE = { width: 360, height: 740 };
let resend, site, browser;

before(async () => {
  resend = await startFakeResend();
  site = await startSite({ resendUrl: resend.url, env: ENV });
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => { await browser?.close(); site?.close(); resend?.close(); });

const F = 'form[data-quote-form="q-main"]';
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: MOBILE, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  return page;
}
const leads = (page) => page.evaluate(() => (window.dataLayer || []).filter((e) => e.event === 'generate_lead').length);

// Press Tab until the focused element matches; fails if it is never reached by keyboard.
async function tabTo(page, selector, max = 25) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => document.activeElement && document.activeElement.matches(s), selector)) return;
    await page.keyboard.press('Tab');
  }
  assert.fail(`keyboard could not reach ${selector}`);
}

// The server drops anything sent within 2.5 s of page load as a bot.
const humanPause = (page) => page.waitForFunction(() => Date.now() - Number(document.querySelector('[name=started_at]').value) > 2600, null, { timeout: 5000 });

async function fillByKeyboard(page, { name = 'Pat Smith' } = {}) {
  await page.goto(site.url + '/request-quote');
  await page.focus(`${F} input[name=service]`);           // first service option
  await page.keyboard.press('ArrowRight');                // radio group: arrow keys move the choice
  await page.keyboard.press('ArrowRight');                // -> third service option
  await tabTo(page, `${F} .step:nth-of-type(1) [data-next]`);
  await page.keyboard.press('Enter');
  await tabTo(page, `${F} [name=details]`);
  await page.keyboard.type('Front steps are cracked & pulling away <from> the porch.');
  await tabTo(page, `${F} [name=zip]`);
  await page.keyboard.type('48021');
  await tabTo(page, `${F} .step:nth-of-type(2) [data-next]`);
  await page.keyboard.press('Enter');
  await tabTo(page, `${F} [name=name]`);
  await page.keyboard.type(name);
  await tabTo(page, `${F} [name=phone]`);
  await page.keyboard.type('5865550123');
  await tabTo(page, `${F} [name=email]`);
  await page.keyboard.type('pat@example.com');
  await tabTo(page, `${F} [type=submit]`);
}

test('keyboard-only submission at 360px lands on /thank-you, fires generate_lead once, and emails the lead', async () => {
  resend.state.emails.length = 0;
  const page = await newPage();
  await page.goto(site.url + '/request-quote?utm_source=google&utm_medium=cpc&gclid=TESTGCLID');
  await fillByKeyboard(page);
  assert.equal(await page.inputValue(`${F} [name=phone]`), '(586) 555-0123', 'phone formatted on blur');
  await humanPause(page);
  await Promise.all([page.waitForURL('**/thank-you'), page.keyboard.press('Enter')]);

  assert.equal(await leads(page), 1, 'generate_lead fires once');
  const ev = await page.evaluate(() => window.dataLayer.find((e) => e.event === 'generate_lead'));
  assert.equal(ev.form_id, 'q-main');
  assert.equal(ev.page_type, 'thank-you');
  await page.reload();
  assert.equal(await leads(page), 0, 'reload does not count twice');

  assert.equal(resend.state.emails.length, 1);
  const { auth, json } = resend.state.emails[0];
  assert.equal(auth, 'Bearer re_e2e');
  assert.deepEqual(json.to, ['leads@example.com', 'owner@example.com']);
  assert.equal(json.from, ENV.RESEND_FROM_EMAIL);
  assert.equal(json.reply_to, 'pat@example.com');
  assert.match(json.subject, /^New quote request: Pat Smith — .+ · 48021$/);
  assert.match(json.html, /tel:\+15865550123/);
  assert.match(json.html, /cracked &amp; pulling away &lt;from&gt; the porch/);
  assert.match(json.html, /TESTGCLID/, 'first-visit gclid carried into the email');
  assert.match(json.html, /\/request-quote/, 'page URL included');
  assert.deepEqual(page.errors, []);
});

test('browser validation puts each message next to its field', async () => {
  const page = await newPage();
  await page.goto(site.url + '/request-quote');
  await page.click(`${F} .step:nth-of-type(1) [data-next]`);
  const err = page.locator(`${F} .step:nth-of-type(1) .field.has-error .error`).first();
  assert.match(await err.textContent(), /Choose the service/);
  const radio = page.locator(`${F} input[name=service]`).first();
  assert.equal(await radio.getAttribute('aria-invalid'), 'true');
  assert.equal(await radio.getAttribute('aria-describedby'), await err.getAttribute('id'));
});

test('server 422 errors appear next to the matching field', async () => {
  resend.state.emails.length = 0;
  const page = await newPage();
  await fillByKeyboard(page);
  // Bypass the browser check for one field so the server's validation answers.
  await page.evaluate((f) => { const n = document.querySelector(f + ' [name=name]'); n.required = false; n.value = ''; }, F);
  await humanPause(page);
  await page.click(`${F} [type=submit]`);
  const err = page.locator(`${F} [name=name]`).locator('xpath=ancestor::div[contains(@class,"field")]').locator('.error');
  await err.waitFor({ state: 'visible' });
  assert.equal(await err.textContent(), 'Enter your name.');
  assert.equal(await page.evaluate(() => document.activeElement.name), 'name');
  assert.equal(await page.isEnabled(`${F} [type=submit]`), true, 'button re-enabled');
  assert.equal(resend.state.emails.length, 0);
});

test('a Resend failure shows the message and phone number, and the button comes back', async () => {
  resend.state.failWith = 500;
  try {
    const page = await newPage();
    await fillByKeyboard(page);
    await humanPause(page);
    await page.keyboard.press('Enter');
    const alert = page.locator(`${F} .form-alert.is-visible`);
    await alert.waitFor();
    assert.match(await alert.textContent(), /didn’t go through.*\(586\) 209-3052/);
    assert.equal(await alert.locator('a[href="tel:+15862093052"]').count(), 1);
    assert.equal(await page.isEnabled(`${F} [type=submit]`), true);
    assert.equal(await page.textContent(`${F} [type=submit]`), 'Request My Free Quote');
    assert.match(page.url(), /\/request-quote$/);
    assert.equal(await leads(page), 0);
  } finally { resend.state.failWith = 0; }
});

test('button is disabled while sending (no double submissions)', async () => {
  resend.state.emails.length = 0;
  const page = await newPage();
  await fillByKeyboard(page);
  await humanPause(page);
  await page.route('**/api/lead', async (route) => { await new Promise((r) => setTimeout(r, 600)); await route.continue(); });
  await page.keyboard.press('Enter');
  assert.equal(await page.isDisabled(`${F} [type=submit]`), true);
  assert.equal(await page.textContent(`${F} [type=submit]`), 'Sending…');
  await page.waitForURL('**/thank-you');
  assert.equal(resend.state.emails.length, 1);
});

test('with JavaScript off the form posts natively and redirects (303)', async () => {
  resend.state.emails.length = 0;
  const page = await newPage({ javaScriptEnabled: false });
  await page.goto(site.url + '/request-quote');
  assert.equal(await page.isVisible(`${F} [name=name]`), true, 'all steps visible');
  assert.equal(await page.isVisible(`${F} [data-next]`), false, 'step buttons hidden');
  await page.check(`${F} input[name=service][value="Chimney"]`);
  await page.fill(`${F} [name=zip]`, '48080');
  await page.fill(`${F} [name=name]`, 'No Script');
  await page.fill(`${F} [name=phone]`, '586-555-0199');
  await Promise.all([page.waitForURL('**/thank-you'), page.click(`${F} [type=submit]`)]);
  assert.equal(resend.state.emails.length, 1);
  assert.match(resend.state.emails[0].json.subject, /^New quote request: No Script — Chimney · 48080$/);

  await page.goto(site.url + '/request-quote');
  await page.fill(`${F} [name=name]`, 'Missing Phone');
  await Promise.all([page.waitForURL('**/form-error'), page.click(`${F} [type=submit]`)]);
  assert.match(await page.textContent('main'), /\(586\) 209-3052/);
  assert.equal(resend.state.emails.length, 1, 'nothing sent for the invalid one');
});

test('thank-you and form-error are noindex; pages fit 360px; axe finds no violations', async () => {
  const page = await newPage();
  for (const p of ['/request-quote', '/thank-you', '/form-error', '/']) {
    await page.goto(site.url + p);
    if (p !== '/request-quote' && p !== '/') {
      assert.match(await page.getAttribute('meta[name=robots]', 'content'), /noindex/);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${p} scrolls sideways by ${overflow}px at 360px`);
    if (axeSource) {
      // Let entrance animations (hero fade-in) finish so contrast is measured on the final colors.
      await page.evaluate(() => Promise.all(document.getAnimations()
        .filter((an) => Number.isFinite(an.effect?.getTiming().iterations)).map((an) => an.finished)));
      await page.addScriptTag({ content: axeSource });
      const r = await page.evaluate(() => window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }));
      assert.deepEqual(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`), [], `axe on ${p}`);
    }
  }
  if (!axeSource) console.log('# axe-core not installed: accessibility scan skipped (npm i -D axe-core)');
});
