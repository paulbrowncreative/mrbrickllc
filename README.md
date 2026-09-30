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
| Guides | `content/posts/*.md` (front matter plus Markdown) |
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

Deploy zip: `python3 build.py && (cd dist && zip -qr ../mrbrickllc-netlify-dist.zip .)`

## Docs
`docs/` contains the launch report, analytics event map, redirect map, URL inventory and metadata map.

## Quote form → email
The quote form posts silently (no page reload, no third-party redirect) to Netlify Forms, which
stores every submission and its photos. `netlify/functions/submission-created.js` then runs
server-side on each verified (non-spam) submission and emails the lead to
**mrbrickdesignco@gmail.com** with the customer's email as reply-to.

Setup (once):
1. Create a free account at resend.com **using mrbrickdesignco@gmail.com**, create an API key.
2. Netlify → Site configuration → Environment variables → add `RESEND_API_KEY` (scope: Functions).
3. Redeploy. Optional: verify mrbrickllc.com in Resend and set `LEAD_FROM="Mr. Brick Website <leads@mrbrickllc.com>"`.
4. Backup: Netlify → Forms → Form notifications → add an email notification to mrbrickdesignco@gmail.com.

Functions only deploy from Git (or the Netlify CLI). A drag-and-drop zip deploy still collects
leads in Netlify Forms, so use step 4 for email in that case.
