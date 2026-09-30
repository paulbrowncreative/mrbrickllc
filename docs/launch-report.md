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
See `analytics-event-map.md`. There are 20 dataLayer events. The primary conversion, `quote_request`, fires once per real submission. First- and last-touch UTM and click-ID attribution travel with each lead into Netlify Forms. No personal data is sent to analytics.

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

- **Images:** AVIF with a JPEG fallback, served responsively at 480–1600 px. (The WebP tier was removed in Sept 2026: AVIF is supported by every current browser, and dropping it cut the deploy by ~13 MB.) Every image has width and height set, and images below the fold lazy-load.
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

---

# Optimization pass — September 2026

## What changed
- **Local SEO architecture:** added six community pages under `/service-areas/`: Eastpointe (home base), St. Clair Shores, the Grosse Pointes, Roseville, Warren and Royal Oak. Each one covers the local housing stock, exposure, permits, the most-requested services, nearby communities and FAQs. They're linked from their county page, the Service Areas menu, the footer, the home page and the relevant service pages. No project claims, addresses or reviews were invented.
- **Navigation:** Services mega menu, plus **Service Areas** (counties and communities) and **About** (About, Reviews, Financing, Offers, FAQs, Guides) dropdowns. Every page in the recommended structure is now one click from the header. Current-section highlighting and keyboard focus-out closing are included.
- **Home page:**
  - A tighter H1 ("Masonry built for Michigan winters") with the location in the eyebrow and lede.
  - A **before/after chimney feature** with a chimney-specific CTA.
  - "Most requested" service links and project-type shortcuts into the gallery.
  - Community links, grouped FAQ selection and a "text a photo" prompt.
- **Service pages:** a verified-facts trust strip in the hero, a dedicated **process** section with its own CTA, "text us a photo" prompts, a gallery link pre-filtered to that service, and links to the community pages that feature the service.
- **FAQs:** expanded from 10 to 19 questions, grouped into Quotes & pricing, Working with Mr. Brick, Projects & timing, and Brick, chimneys & foundations, with topic navigation. Cost answers explain what drives price; no prices are published.
- **Gallery:** `?type=` deep links (used by service pages and the home page), a filter-aware link to the matching service, and a lightbox link from any photo to its service page.
- **Quote form:**
  - Photos are downscaled in the browser before upload, so phone photos fit under Netlify's 8 MB limit.
  - Up to 5 images, with type validation and a selected-file summary.
  - Double-submit guard.
  - Phone auto-formatting.
  - Email becomes required when "Email" is the preferred contact method.
  - Field length limits and clearer microcopy.
  - A new `form_service_select` event.
- **Footer:** NAP block (name, city, ZIP, phone, text, email), hours, a quote button, and service-area and community links.
- **Technical SEO:**
  - The `sitemap.xml` `lastmod` is emitted only where it's known (guides and legal pages) instead of stamping every URL with the build date.
  - Richer `HomeAndConstructionBusiness` schema: community `areaServed`, `knowsAbout` and an `OfferCatalog` of every service.
  - `Service` schema now has county `areaServed` and an image.
  - `WebPage` schema links to its `BreadcrumbList` and primary image.
  - FAQ schema text is stripped of HTML.
- **Headers:** moved from `netlify.toml` to a generated `dist/_headers`, so Git deploys and drag-and-drop zip deploys behave the same. `upgrade-insecure-requests` was added to the CSP.

## Verified
- **Build:** 56 pages (54 indexable), all in the sitemap. There are no orphan pages and no broken internal links.
- **Metadata:** unique titles (70 characters or fewer) and descriptions (165 or fewer), exactly one H1 per page, every JSON-LD block parses, and every image has alt text.
- **Accessibility:** axe-core (WCAG 2.0/2.1/2.2 AA plus best practice) reports **0 violations** on 17 templates at 1440 px and 390 px.
- **Layout:** no horizontal overflow and no console errors on 9 key pages at 320, 375, 390, 414, 768, 1024, 1280, 1440 and 1920 px.
- **Quote form, end to end:**
  - Service pre-select and step validation.
  - The conditional email requirement and phone formatting.
  - Photo summary and a single POST despite a double click.
  - The redirect to `/thank-you` and the `quote_request` event.
- **Performance** (simulated mobile: 150 ms latency, 1.6 Mbps, 4× CPU slowdown):
  - Home: LCP 1.7 s, CLS 0
  - Service page: LCP 1.6 s, CLS 0
  - Community page: LCP 1.6 s, CLS 0

## Still needs the owner
- Confirm the phone number (the site uses 586-209-3052, but Facebook lists 586-250-8329).
- Confirm whether the street address should be public.
- Confirm the 20% promotion and its end date.
- Review the community-page copy and community lists.
- Add the Google review link and Google Maps URL to `content/site.yaml`.
- Add real reviews to `content/reviews.yaml`.
- Add the GTM ID.

---

# Full QA pass — September 30, 2026

## Fixed
- **Heading outline:** the Services mega menu used eight `<h2>` labels, which put headings above the H1 on every page. They're now styled paragraphs. Every page now starts with its H1 and never skips a heading level.
- **Title tags:** all titles now fit Google's display width (60 characters or fewer). Titles lead with the service or city keyword and end with the brand.
- **Service H1s:** every service page H1 now carries the location ("Chimney repair *in Southeastern Michigan*"), shown as a secondary line. Generic hub and utility H1s were given keywords: "Concrete contractor…", "Masonry FAQs", "Masonry project gallery", "Mr. Brick reviews".
- **Guide breadcrumbs:** the last item (on screen and in `BreadcrumbList`) is now the article title, not the category.
- **Schema:**
  - `BlogPosting` has a named author, `articleSection` and `inLanguage`.
  - Area pages declare a `contentLocation`: a City or County, with City pages nested in their county.
  - Service `WebPage` blocks point to their `Service` as `mainEntity`.
- **Social tags:** `og:image:width`/`height`, `twitter:image:alt`, and article publish-time and section tags were added.
- **Image sitemap:** each URL in `sitemap.xml` now lists the project photos rendered on that page, which helps the photos appear in Google Images.
- **Unique copy:** the one sentence shared between the Wayne County and Grosse Pointe pages was rewritten.
- **Gallery:** added about 150 words of useful content ("About these projects", "Browse by service").
- **Footer:** the quote button no longer inherits the footer's link underline.

## Verified on the final build
- **Pages and links:** 56 pages (54 indexable), all in the sitemap. No orphan pages, no broken links or missing assets, no duplicate titles or descriptions, and exactly one H1 per page.
- **Schema:**
  - 10 types across 380+ blocks.
  - Required properties are present and every `@id` reference resolves.
  - Every page's FAQ markup matches the FAQs visible on it.
- **Accessibility:** axe-core (WCAG 2.2 AA plus best practice) reports 0 violations on 17 templates at desktop and mobile widths.
- **Layout:** no horizontal overflow and no console errors on 9 page types at 7 widths from 320 to 1920 px.
- **Quote form, end to end:** validation, conditional email, a single POST on double-click, and the `/thank-you` conversion event.

## Deliberately not changed
- **URL slugs.** The existing slugs (`/chimney-repair`, `/tuckpointing`, `/porch-rebuilds`, and so on) are the URLs Google has already indexed for www.mrbrickllc.com. Renaming them would restart their ranking history for a marginal keyword gain, so they stay. New pages use clean, descriptive slugs.
- **FAQPage markup.** It's kept because it's accurate and matches the visible questions. Google currently shows FAQ rich results mainly for government and health sites, so expect no FAQ snippets from it; other search and AI engines still read it.

---

# Reviews — September 30, 2026
- **34 verified Google reviews**, all 5-star, are in `content/reviews.yaml`, copied word for word as supplied.
  - Home page and every service page: a scrolling review row with Pause/Play, pause on hover or focus, and a still, swipeable row for reduced motion.
  - `/reviews`: every review as a card.
  - Service pages lead with the reviews that mention that kind of work (keyword ranking in `build.py`: `REVIEW_KEYWORDS`).
- **Summary line:** "5.0 out of 5 on Google from 36 reviews", linking to the Business Profile. Keep `google_rating` and `google_review_count` in `site.yaml` current.
- **Excluded:** Joseph K.'s post. It's written by a team member ("we specialize…", "ask for Joe"), and presenting insider content as a customer review violates the FTC Consumer Reviews rule (16 CFR 465) and Google's review policies.
- **No `AggregateRating` / `Review` schema was added.** Google doesn't award review stars to a business marking up reviews about itself (it treats them as self-serving), and the rating is Google's own.
