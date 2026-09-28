# Analytics event map — Mr. Brick

All events are pushed to `window.dataLayer` from one file (`static/js/site.js`, section 1).
GTM is the only tag loaded, and only when `tracking.gtm_id` is set in `content/site.yaml`.
**No personal data is ever pushed.** That means no name, phone, email, message, street address or ZIP.

Every event carries `page_type` (home, service, area, post, gallery, quote, thank-you, page) and `device_type`. Service pages also carry `service_page`.

| Event | Trigger | Extra parameters | GA4 | Google Ads | Mark as conversion? |
|---|---|---|---|---|---|
| `page_view` | GA4 config tag in GTM | — | Yes | — | No |
| `view_service` | Load of any service page | `service_name` | Yes | Audience | No |
| `click_phone` | Any `tel:` link | `cta_location` | Yes | **Phone call (website click)** | Yes (Ads secondary) |
| `click_text` | Any `sms:` link | `cta_location` | Yes | Optional | Yes (Ads secondary) |
| `click_email` | Any `mailto:` link | `cta_location` | Yes | — | No |
| `click_quote` | Any link to `/request-quote` | `cta_location` | Yes | — | No |
| `cta_click` | Any element with `data-cta` | `cta_id`, `cta_location` | Yes | — | No |
| `financing_click` | Link to `/finance` | `cta_location` | Yes | — | No |
| `review_click` | Review platform links | `review_platform` | Yes | — | No |
| `navigation_click` | Header or footer nav links | `nav_area`, `nav_item` | Yes | — | No |
| `form_start` | First focus inside a quote form | `form_id` | Yes | — | No |
| `form_step` | Advancing a step | `form_id`, `step` | Yes | — | No |
| `form_error` | Validation or submit failure | `form_id`, `field_name`, `step` | Yes | — | No |
| `file_upload` | Photos selected | `form_id`, `file_count` | Yes | — | No |
| `form_submit` | Valid submit attempt | `form_id`, `service_type`, `property_type` | Yes | — | No |
| `form_success` | Netlify accepted the submission | `form_id`, `service_type`, `property_type` | Yes | — | No (see below) |
| `quote_request` | `/thank-you` load, once per submission (sessionStorage guard) | `form_id`, `service_type`, `property_type` | Yes, as `generate_lead` | **Quote request** | **Yes (primary)** |
| `gallery_filter` | Gallery filter chip | `filter` | Yes | — | No |
| `view_project` | Lightbox opened | `project_id` | Yes | — | No |

`cta_location` values: `header`, `mobile_bar`, `mobile_menu`, `hero`, `page_hero`, `service_hero`, `promo_bar`, `quote_form`, `contact_block`, `cta_band`, `finance_aside`, `post_aside`, `reviews`, `footer`, `body`.

## Recommended GTM setup

1. **GA4 Configuration** tag on all pages.
2. **GA4 Event** tag that fires on a Custom Event trigger matching the regex `^(view_service|click_phone|click_text|click_email|click_quote|cta_click|financing_click|review_click|navigation_click|form_start|form_step|form_error|file_upload|form_submit|form_success|gallery_filter|view_project)$`. Pass the dataLayer variables listed above as event parameters.
3. **GA4 Event `generate_lead`** that fires on the `quote_request` custom event. Mark it as a key event in GA4.
4. **Google Ads conversions**:
   - *Quote request*, fired on `quote_request`. This is the primary conversion.
   - *Phone call click*, fired on `click_phone`. This is secondary.
   - *Calls from website* uses Google forwarding numbers on the phone links. This is the only way to measure real calls rather than taps; configure it in Google Ads if call volume matters.
5. **Conversion Linker** tag on all pages. The site also stores `gclid`, `gbraid` and `wbraid` and submits them with each lead, so leads can be imported offline later.

## Lead attribution (in the form submission, not analytics)
Each quote submission includes these hidden fields:
- UTM fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`
- Ad click IDs: `gclid`, `gbraid`, `wbraid`
- Touch history: `first_touch`, `last_touch`, `landing_page`, `referrer`, `submitted_from`

They're visible in Netlify → Forms → quote.
