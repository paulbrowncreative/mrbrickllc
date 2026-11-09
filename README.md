# mrbrickllc.com

A static site for Mr. Brick LLC, deployed on Netlify.

## Edit content
| What | Where |
|---|---|
| Phone, hours, social links, promotions, GTM ID | `content/site.yaml` |
| Services (27 pages) | `content/services.yaml` |
| County and community pages | `content/areas.yaml` (`areas:` counties, `cities:` community pages) |
| General FAQs | `content/faqs.yaml` (`group` = section on /faqs, `home: true` = shown on the home page) |
| Verified reviews | `content/reviews.yaml` |
| Blog posts (`/blog/<slug>`) | `content/posts/*.md`: front matter (title, slug, seo_title, description, date, image, services, optional faqs/featured/updated) plus Markdown. First service sets the category. `[[photo:image-id|Caption]]` on its own line inserts a project photo. |
| Legal pages | `content/legal.yaml` |
| Photos | Add the file to `src-images/`, add an entry in `content/images.yaml`, then run `python3 tools/optimize_images.py` |

## Build and preview
```
pip install -r requirements.txt
python3 build.py              # -> dist/
python3 tools/serve.py 8080   # http://127.0.0.1:8080 (mimics Netlify pretty URLs)
```
Netlify runs `python3 build.py` and publishes `dist/` (see `netlify.toml`).
`build.py` also writes `dist/_headers` (security + cache headers), `dist/_redirects`, `sitemap.xml`
and `robots.txt`, so a zipped `dist/` can be deployed by drag-and-drop with identical behavior.

Deploy zip: `python3 build.py && (cd dist && zip -qr ../mrbrickllc-netlify-dist.zip .)` — pages only; it does **not** include the `/api/lead` function, so the quote form needs a Git deploy (see below).

## Docs
`docs/` contains the launch report, analytics event map, redirect map, URL inventory and metadata map.

## Quote form → email (Resend)

### How a submission flows
1. The form (`templates/partials/quote_form.html`, on the home, contact, quote and service pages) is a real
   `<form action="/api/lead" method="post">`.
2. **With JavaScript** (`static/js/site.js`): fields are checked in the browser, then sent with `fetch`
   (`Accept: application/json`). The button is disabled while sending. Server validation errors (422) show
   next to the matching field; a failed send shows a message with the phone number. On success the script
   sets a `sessionStorage` flag and goes to `/thank-you`, which fires the `generate_lead` dataLayer event
   once and deletes the flag (a reload doesn't count twice).
3. **Without JavaScript** the browser posts the form normally and the server answers with a
   303 redirect to `/thank-you` or `/form-error`.
4. `netlify/functions/lead.mjs` (route `/api/lead`) hands the request to `netlify/lib/lead.mjs`, which:
   - rejects bodies over 20 KB; accepts form-encoded or JSON; trims, caps and strips control characters;
   - drops spam with a fake success (honeypot `bot-field` filled, sent < 2.5 s after page load via
     `started_at`, or more than 2 links) — nothing is emailed;
   - re-runs the browser's checks (422 with one error per field);
   - emails the lead through Resend: branded HTML + plain text, tap-to-call button, reply-to set to the
     customer's email, time in America/Detroit, and a source/tracking section (page URL, landing page,
     referrer, UTM tags, gclid — first-visit values kept in `localStorage` for 30 days);
   - returns 502 if `RESEND_API_KEY` is missing or Resend errors. There is no fallback provider, and the
     error is logged in Netlify → Logs → Functions → `lead`.
   Secrets are read only inside the function and never reach the browser.

Photos aren't uploaded through the form (requests are capped at 20 KB); the form and thank-you page ask
customers to text photos to the business number.

### Setup (once)
1. **Resend account and key.** Sign up at resend.com, then API Keys → Create API key (Sending access).
2. **Verify the sending domain.** Resend → Domains → Add domain → `mrbrickllc.com`. Add the DNS records
   Resend lists (SPF/DKIM TXT records and an MX record on the `send` subdomain) at the domain's DNS host and
   wait until the domain shows **Verified**. Until then Resend refuses mail from `leads@mrbrickllc.com`
   and the form returns 502.
3. **Environment variables.** Netlify → Site configuration → Environment variables, scope *Functions*
   (see `.env.example`):
   - `RESEND_API_KEY` — the key from step 1 (mark it secret)
   - `LEAD_TO_EMAIL` — recipients, comma-separated
   - `RESEND_FROM_EMAIL` — `Mr. Brick Website <leads@mrbrickllc.com>`
4. **Redeploy** (Deploys → Trigger deploy). Functions read env variables at deploy time, so redeploy after
   every change to them.
5. Send one real test lead from the live site and confirm it arrives.

**Functions deploy only from Git (or the Netlify CLI).** A drag-and-drop zip of `dist/` publishes the
pages but not `/api/lead`, and the form would fail. Deploy by pushing to the branch Netlify builds from.

### Tests
```
node --test tests/*.test.mjs                 # unit tests (fake fetch, no network)
python3 build.py && node --test tests/e2e/*.e2e.mjs   # browser tests: Playwright + fake Resend
```
The browser tests need Playwright with Chromium importable from Node; `axe-core` is optional (the
accessibility scan is skipped without it). They cover a keyboard-only submission at 360 px, browser and
server validation, a Resend failure, the disabled button, JavaScript turned off, noindex and axe.

## After each live deploy
- `python3 tools/indexnow.py` notifies Bing, Yandex and other IndexNow engines of every sitemap URL. Run it only once the site is live on www.mrbrickllc.com.
- Google: submit or resubmit `https://www.mrbrickllc.com/sitemap.xml` in Search Console.
