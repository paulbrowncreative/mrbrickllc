# Mr. Brick LLC — rebuild launch report

## Summary
- **Pages:** 50 static pages (48 indexable, plus `/thank-you` and `/404`).
- **Stack:** Python/Jinja build to plain HTML, CSS and ~9 KB of JS, hosted on Netlify with Netlify Forms.
- **What's gone:** no framework, no CMS runtime, no third-party scripts until GTM is configured.
- **Content:** managed in `content/*.yaml` and `content/posts/*.md`.

## URL changes
The full list is in `url-inventory.csv` and `redirect-map.csv`.

- **Kept (34):** Every surviving page keeps its exact legacy URL, including `/chimney-repair`, `/tuckpointing`, `/porch-rebuilds`, `/gallery`, `/finance`, `/faqs`, `/special-offers` and `/request-quote`. The hierarchy comes from breadcrumbs and navigation, not new folders.
- **Consolidated with a 301 (19):** thin, overlapping pages were merged into the strongest matching page:
  - The three walkway sub-pages → `/walkway-services`
  - Stair sub-pages → `/stair-services`
  - Fireplace sub-pages → `/fireplace-services`
  - Acid staining and stamped patio → `/stamped-concrete`
  - Coating → `/concrete-sealing`
  - Demolition → `/concrete-services`
  - Resurfacing → `/driveway-repair`
  - Brick pavers → `/paver-services`
  - Concrete and stone patios → `/patio-services`
  - Foundation installation and waterproofing → `/foundation-services`
  - Retaining wall installation → `/retaining-wall-services`
  - Specialty masonry → `/brick-masonry`
- **Removed with a 301 (5):** vendor popups and splash pages such as `/call-or-text-pop` and `/hibu-video-splash`.
- **New (14):**
  - `/services`, `/brick-masonry`, `/brick-repair`
  - `/service-areas` plus Macomb, Wayne and Oakland county pages
  - `/resources` plus 3 guides
  - Privacy, terms and accessibility pages
- There are no redirect chains; the build fails if a redirect target is missing or a source is still a live page.

## SEO
- **Metadata:** every page has a unique title and meta description, a self-referencing canonical, one H1, Open Graph and Twitter tags, and a logical H2/H3 structure. See `metadata-map.csv`.
- **Crawl files:** the XML sitemap lists the 48 indexable pages. `robots.txt` blocks only `/thank-you`, and thank-you and 404 are `noindex`.
- **Structured data:**
  - Every page: `HomeAndConstructionBusiness`, `WebSite`, `WebPage` and `BreadcrumbList`.
  - Page-specific: `Service` on service pages, `FAQPage` wherever FAQs are visible, `BlogPosting` on guides, and `CollectionPage`, `AboutPage` or `ContactPage` where they fit.
  - Nothing is fabricated: no ratings, no review markup, no street address (see input needed).
- **Local SEO:** there are three county pages with genuinely local content instead of dozens of swapped-city doorway pages. City pages should be added only when real local projects exist for them.
- **Internal linking:**
  - Service pages link to related services, their category hub, relevant guides, all three county pages and the quote form.
  - County pages link to their six most relevant services and the gallery.
  - Guides link into the service pages.
  - No orphan pages; this was verified by a crawl.
- **Content quality:** every service page was rewritten from scratch. The placeholder text, the "2o%" typo, duplicated sections and questionable service claims (mold remediation, electrical and plumbing, gabion walls, and so on) are gone.

## Conversion
- **Quote access everywhere:**
  - A sticky header with click-to-call and a Free Quote button.
  - A persistent mobile bar with Call, Text and Free Quote.
  - A quote form at the bottom of the home, service and contact pages.
  - A dedicated `/request-quote` page.
- **Three-step quote form:**
  - Step 1: service and property type.
  - Step 2: details, ZIP code, timeframe and photos.
  - Step 3: contact details. Email is optional.
- **Form behavior:**
  - Service pages pre-select the right service, and `?service=` deep links work.
  - Inline accessible errors and a honeypot.
  - An 8 MB upload guard.
  - A no-JavaScript fallback that submits as a normal form.
- **Proof and trust:** real project photography throughout; the verified facts (25+ years, family owned, licensed and insured, 10-year warranty, price match, financing) are repeated where objections occur.
- **Offers:** promotions are managed in `site.yaml` with start and end dates and are hidden automatically once expired, even on a stale build.

## Measurement
See `analytics-event-map.md`. There are 19 dataLayer events. The primary conversion, `quote_request`, fires once per real submission. First- and last-touch UTM and click-ID attribution travel with each lead into Netlify Forms. No personal data is sent to analytics.

## Accessibility
axe-core (WCAG 2.0/2.1/2.2 AA plus best practice) reports **0 violations on the 15 audited templates**.
- Skip link, landmarks and a keyboard-operable mega menu with Escape to close.
- Visible focus rings and native `<details>` FAQs.
- A `<dialog>` lightbox that supports arrow keys.
- Labeled fields with `aria-invalid` and `aria-describedby` errors.
- Reduced-motion support. Tap targets meet WCAG 2.2's 24 px minimum everywhere, and primary controls (buttons, the mobile bar, form choices) are 44 px or larger.

## Performance
Measured on a simulated mobile connection (150 ms latency, 1.6 Mbps, 4× CPU slowdown) against a local server:

| Page | LCP | CLS | Transfer |
|---|---|---|---|
| Home | 1.5 s | 0.000 | 386 KB |
| Chimney repair | 0.6 s | 0.000 | 72 KB |

- **Images:** AVIF and WebP with a JPEG fallback, served responsively at 480–1600 px. Every image has width and height set, and images below the fold lazy-load.
- **Hero:** the hero image is preloaded with `fetchpriority=high`.
- **Font:** one self-hosted variable font (90 KB) covers every weight and width.
- **Assets:** CSS and JS are content-hashed and cached as immutable.
- **Recheck:** measure again with Lighthouse and PageSpeed Insights on the live Netlify URL.

## QA performed
- No horizontal overflow and no console errors on 8 key templates at all 11 widths (1920, 1440, 1280, 1024, 834, 768, 430, 414, 390, 375 and 360 px).
- The quote form was run end to end: pre-select, validation, step navigation, the failed-submit error state, attribution fields and the dataLayer sequence.
- The gallery filters, lightbox, mobile menu and mega menu were all exercised.
- All internal links return 200, and all JSON-LD blocks parse.
- **Not yet tested:** a live Netlify form submission, which needs a deploy.

## Remaining recommendations (priority order)
1. **Reviews.** This is the largest gap against competitors; one Detroit-area competitor shows 400+ reviews. Set up the Google Business Profile review link, ask every past customer, and add verified reviews to `content/reviews.yaml`.
2. **Unify NAP.** One phone number everywhere (the site, Google, Facebook and Yelp) and one Facebook page.
3. **Project stories.** Add titles, cities and materials to the best 10–15 photos, plus before and after shots where possible. The data model supports it.
4. **City pages.** Add them only for communities with several real jobs and photos.
5. **Guides.** Publish roughly one per month on a real customer question. Leave out cost articles until you have real price ranges.
6. **Call tracking.** Enable Google Ads forwarding numbers or a call-tracking provider to measure real calls, not just taps.
7. **Server-side validation.** Optionally add a Netlify Function in front of the form for validation and routing, for example CRM or SMS alerts.

## Pre-launch checklist
- [ ] Owner has reviewed all copy, especially service scopes, timelines and legal pages.
- [ ] Owner has answered the input-needed items: phone, address, the 20% promo, service lists, waterproofing, leveling and staining.
- [ ] Connect the repo to Netlify, set the custom domain `www.mrbrickllc.com` with the apex redirecting to www, and let Netlify provision HTTPS.
- [ ] Netlify → Forms: enable form detection and add a notification email to mrbrickdesignco@gmail.com.
- [ ] Submit a real test lead with a photo and confirm the email, attachment and attribution fields arrive.
- [ ] Add the GTM ID in `site.yaml`, configure tags per the event map, and check them in GTM Preview and GA4 DebugView.
- [ ] Before the DNS switch, spot-check 5 legacy URLs and 5 redirects on the Netlify preview.
- [ ] After the switch: submit the sitemap in Google Search Console, inspect the home page and 3 service pages, and watch the Pages and 404 reports for 4 weeks.
- [ ] Update the website URL and hours in Google Business Profile if they changed. Cancel the old Hibu site only after the DNS move.
- [ ] Remove the old Bing, iPromote and Facebook pixels unless they're re-added through GTM.
