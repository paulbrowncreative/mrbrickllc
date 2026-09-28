"""Mr. Brick static site builder.

    python3 build.py            -> renders everything into dist/

Content lives in content/*.yaml and content/posts/*.md; templates in
templates/; assets in static/. Photos are pre-optimized by
tools/optimize_images.py (not run on deploy).
"""
import datetime as dt
import hashlib
import html
import json
import pathlib
import re
import shutil

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

ROOT = pathlib.Path(__file__).resolve().parent
DIST = ROOT / "dist"
C = ROOT / "content"

site = yaml.safe_load(open(C / "site.yaml"))
svc_data = yaml.safe_load(open(C / "services.yaml"))
area_data = yaml.safe_load(open(C / "areas.yaml"))
faqs = yaml.safe_load(open(C / "faqs.yaml"))
reviews = (yaml.safe_load(open(C / "reviews.yaml")) or {}).get("reviews") or []
images = json.load(open(C / "_image_manifest.json"))
BASE = site["base_url"].rstrip("/")
TODAY = dt.date.today().isoformat()

# ------------------------------------------------------------------ services
services = svc_data["services"]
for slug, s in services.items():
    s["slug"] = slug
    s.setdefault("hub", False)
cats = svc_data["categories"]
for c in cats:
    c["children"] = [s for s in services.values() if s["category"] == c["id"] and not s["hub"]]
cat_by_id = {c["id"]: c for c in cats}

FORM_SERVICES = ["Brick & Masonry", "Chimney", "Fireplace", "Porch", "Steps / Stairs", "Concrete",
                 "Driveway", "Walkway", "Pavers", "Patio", "Retaining Wall", "Foundation", "Other"]
FORM_MAP = {"brick": "Brick & Masonry", "chimney": "Chimney", "porch": "Porch", "concrete": "Concrete",
            "flatwork": "Driveway", "outdoor": "Patio", "structural": "Foundation"}
FORM_OVERRIDE = {"fireplace-services": "Fireplace", "stair-services": "Steps / Stairs", "walkway-services": "Walkway",
                 "paver-services": "Pavers", "retaining-wall-services": "Retaining Wall", "stamped-concrete": "Concrete"}
for slug, s in services.items():
    s["form_service"] = FORM_OVERRIDE.get(slug, FORM_MAP[s["category"]])

areas = area_data["areas"]
cities = area_data.get("cities") or {}
for slug, c in cities.items():
    c["slug"] = slug
    assert c["county"] in areas, f"city {slug}: unknown county {c['county']}"
    for f in c["focus"]:
        assert f in services, f"city {slug}: unknown service {f}"
for slug, a in areas.items():
    a["slug"] = slug
    a["cities"] = [c for c in cities.values() if c["county"] == slug]

# ------------------------------------------------------------------ promotions
def active_promos():
    out = []
    for p in site.get("promotions", []):
        if not p.get("active"):
            continue
        if p.get("starts") and str(p["starts"]) > TODAY:
            continue
        if p.get("ends") and str(p["ends"]) < TODAY:
            continue
        out.append(p)
    return out
promos = active_promos()
banner_promo = next((p for p in promos if p.get("banner")), None)

# ------------------------------------------------------------------ posts
posts = []
for f in sorted((C / "posts").glob("*.md")):
    raw = f.read_text()
    _, fm, body = raw.split("---", 2)
    meta = yaml.safe_load(fm)
    meta["html"] = markdown.markdown(body, extensions=["extra", "sane_lists"])
    meta["date"] = str(meta["date"])
    posts.append(meta)
posts.sort(key=lambda p: p["date"], reverse=True)

# ------------------------------------------------------------------ assets
def fingerprint():
    out = {}
    for rel in ["css/site.css", "js/site.js"]:
        src = ROOT / "static" / rel
        h = hashlib.sha256(src.read_bytes()).hexdigest()[:10]
        name = src.stem + "." + h + src.suffix
        out[rel] = "/static/" + str(pathlib.PurePosixPath(rel).parent / name)
    return out

# ------------------------------------------------------------------ jinja
env = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=select_autoescape(["html"]),
                  trim_blocks=True, lstrip_blocks=True)

def paras(text):
    parts = [p.strip() for p in (text or "").strip().split("\n\n") if p.strip()]
    return Markup("".join("<p>" + html.escape(" ".join(p.split())) + "</p>" for p in parts))
env.filters["paras"] = paras
env.tests["contains"] = lambda seq, x: x in (seq or [])

ASSETS = {}
# Gallery tag -> the service page that best explains that kind of work.
TAG_SERVICE = {"chimneys": "chimney-services", "porches": "porch-services", "steps": "stair-services",
               "brick": "brick-masonry", "stone": "stair-services", "concrete": "concrete-services",
               "driveways": "driveway-services", "walkways": "walkway-services", "pavers": "paver-services",
               "patios": "patio-services", "retaining-walls": "retaining-wall-services",
               "foundations": "foundation-services"}

def strip_tags(text):
    return re.sub(r"<[^>]+>", "", text or "")
env.filters["strip_tags"] = strip_tags

env.globals.update(site=site, images=images, categories=cats, services=services, areas=areas, cities=cities,
                   tag_service=TAG_SERVICE,
                   faqs=faqs, reviews=reviews, promos=promos, banner_promo=banner_promo,
                   form_services=FORM_SERVICES, posts=posts, year=dt.date.today().year,
                   asset=lambda rel: ASSETS[rel])

# ------------------------------------------------------------------ schema
BIZ_ID = BASE + "/#business"
def business_schema():
    a = site["address"]
    addr = {"@type": "PostalAddress", "addressLocality": a["city"], "addressRegion": a["region"],
            "postalCode": a["postal"], "addressCountry": a["country"]}
    if a.get("show_street"):
        addr["streetAddress"] = a["street"]
    extra = {}
    if site.get("google_maps_url"):
        extra["hasMap"] = site["google_maps_url"]
    hours = [{"@type": "OpeningHoursSpecification", "dayOfWeek": h["days"], "opens": h["opens"], "closes": h["closes"]}
             for h in site["hours"] if h.get("opens")]
    return {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "@id": BIZ_ID,
        "name": site["name"],
        "url": BASE + "/",
        "telephone": site["phone_e164"],
        "email": site["email"],
        "logo": BASE + "/static/img/mr-brick-logo-480.png",
        "image": BASE + "/static/img/crew-brick-pillars-stone-steps-1200.jpg",
        "description": "Family-owned masonry and concrete contractor serving Southeastern Michigan with brick repair, tuckpointing, chimney repair and rebuilding, porches and steps, concrete, driveways, pavers, patios, foundations and retaining walls.",
        "slogan": "He's honest, he's practical, he's quick.",
        "address": addr,
        "areaServed": [{"@type": "AdministrativeArea", "name": n} for n in
                       ["Macomb County, MI", "Wayne County, MI", "Oakland County, MI", "Southeastern Michigan"]]
                      + [{"@type": "City", "name": (c["name"].replace("The ", "") + ", MI")} for c in cities.values()],
        "openingHoursSpecification": hours,
        "knowsAbout": [c["name"] for c in cats],
        "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Masonry and concrete services", "itemListElement": [
            {"@type": "OfferCatalog", "name": c["name"], "itemListElement": [
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": x["name"], "url": BASE + "/" + x["slug"]}}
                for x in [services[c["hub"]]] + c["children"]]} for c in cats]},
        "paymentAccepted": ", ".join(site["payment_methods"]),
        "sameAs": [s["url"] for s in site["social"]],
        **extra,
    }

def crumbs_schema(crumbs):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "@id": url_of(crumbs[-1][1]) + "#breadcrumb", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": BASE + (u if u != "/" else "/")}
        for i, (n, u) in enumerate(crumbs)]}

def faq_schema(items):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": strip_tags(f["a"])}} for f in items]}

def webpage_schema(p):
    out = {"@context": "https://schema.org", "@type": p.get("schema_type", "WebPage"), "@id": p["canonical"] + "#webpage",
           "url": p["canonical"], "name": p["title"], "description": p["description"], "inLanguage": "en-US",
           "isPartOf": {"@id": BASE + "/#website"}, "about": {"@id": BIZ_ID},
           "primaryImageOfPage": {"@type": "ImageObject", "url": BASE + p["og_image"]}}
    if p.get("crumbs"):
        out["breadcrumb"] = {"@id": p["canonical"] + "#breadcrumb"}
    return out

WEBSITE = {"@context": "https://schema.org", "@type": "WebSite", "@id": BASE + "/#website", "url": BASE + "/",
           "name": site["name"], "publisher": {"@id": BIZ_ID}, "inLanguage": "en-US"}

# ------------------------------------------------------------------ pages
PAGES = []  # dicts: path, template, title, description, ...

def url_of(path):
    return BASE + ("/" if path == "/" else path)

def add(path, template, title, description, **kw):
    p = dict(path=path, template=template, title=title, description=description, **kw)
    p["canonical"] = url_of(path)
    img = p.get("og_image_id") or p.get("hero_image") or p.get("lcp_image") or "crew-brick-pillars-stone-steps"
    p["og_image"] = f"/static/img/{img}-{images[img]['jpg']}.jpg"
    p["og_image_alt"] = images[img]["alt"]
    if p.get("hero_image") and not p.get("lcp_image"):
        p["lcp_image"] = p["hero_image"]
        p["lcp_sizes"] = "(min-width: 64em) 42vw, 100vw"
    PAGES.append(p)
    return p

def photos_for(tags, exclude=None, n=6):
    tags = set(tags)
    primary = [i for i, m in images.items() if m["tags"][0] in tags and i != exclude]
    secondary = [i for i, m in images.items() if i not in primary and tags & set(m["tags"]) and i != exclude and "company" not in m["tags"]]
    return (primary + secondary)[:n]

H = ("Home", "/")
HOME_FAQS = [f for f in faqs if f.get("home")]
AREA_SCHEMA = [{"@type": "AdministrativeArea", "name": a["name"] + ", MI"} for a in areas.values()]
FAQ_GROUPS = []
for f in faqs:
    g = next((x for x in FAQ_GROUPS if x[0] == f["group"]), None)
    if not g:
        g = (f["group"], [])
        FAQ_GROUPS.append(g)
    g[1].append(f)

add("/", "home.html", "Masonry Contractor in Eastpointe & Southeast Michigan | Mr. Brick",
    "Family-owned masonry and concrete contractor in Eastpointe serving Southeastern Michigan for 25+ years: brick, chimneys, porches, steps, concrete. Free quotes.",
    type="home", h1="Masonry built for Michigan winters", lcp_image="crew-brick-pillars-stone-steps", lcp_sizes="(min-width: 64em) 48vw, 100vw",
    og_title="Mr. Brick LLC — Masonry Contractors in Southeastern Michigan",
    extra_schema=[faq_schema(HOME_FAQS)])

add("/services", "services_index.html", "Masonry & Concrete Services | Mr. Brick LLC",
    "Every masonry and concrete service Mr. Brick offers in Southeastern Michigan: brick, chimneys, porches, concrete, driveways, pavers, patios, foundations and walls.",
    h1="Masonry and concrete services", lede="Seven trades, one contractor. Find your project below, or call and describe it — we'll point you the right way.",
    crumbs=[H, ("Services", "/services")], hero_cta=True)

for slug, s in services.items():
    cat = cat_by_id[s["category"]]
    hub = services[cat["hub"]]
    crumbs = [H, ("Services", "/services")]
    if not s["hub"]:
        crumbs.append((hub["name"], "/" + hub["slug"]))
    crumbs.append((s["name"], "/" + slug))
    related = [services[r] for r in s.get("related", [])]
    extra = [{"@context": "https://schema.org", "@type": "Service", "@id": url_of("/" + slug) + "#service",
              "name": s["name"], "serviceType": s["name"], "description": s["description"],
              "url": url_of("/" + slug), "provider": {"@id": BIZ_ID},
              "image": BASE + f"/static/img/{s['image']}-{images[s['image']]['jpg']}.jpg",
              "areaServed": AREA_SCHEMA + [{"@type": "AdministrativeArea", "name": "Southeastern Michigan"}]}]
    if s.get("faqs"):
        extra.append(faq_schema(s["faqs"]))
    add("/" + slug, "service.html", s["title"], s["description"], type="service", service_slug=slug,
        svc=s, hub=hub, children=cat["children"] if s["hub"] else [], related=related,
        photos=photos_for(s.get("tags", []), exclude=s["image"]), crumbs=crumbs,
        lcp_image=s["image"], lcp_sizes="(min-width: 64em) 42vw, 100vw", og_image_id=s["image"], extra_schema=extra)

ah = area_data["hub"]
add("/service-areas", "areas_hub.html", ah["title"], ah["description"], h1=ah["h1"], lede=ah["lede"],
    crumbs=[H, ("Service Areas", "/service-areas")], hero_cta=True, hero_image="brick-porch-entry")
for slug, a in areas.items():
    add(f"/service-areas/{slug}", "area.html", a["title"], a["description"], h1=a["h1"], lede=a["lede"],
        area=a, hero_image=a["image"], hero_cta=True, type="area",
        photos=photos_for([t for f in a["focus"] for t in services[f].get("tags", [])], exclude=a["image"], n=6),
        crumbs=[H, ("Service Areas", "/service-areas"), (a["name"], f"/service-areas/{slug}")],
        extra_schema=[faq_schema(a["faqs"])] if a.get("faqs") else [])
for slug, c in cities.items():
    county = areas[c["county"]]
    add(f"/service-areas/{slug}", "area.html", c["title"], c["description"], h1=c["h1"], lede=c["lede"],
        area=c, county=county, hero_image=c["image"], hero_cta=True, type="area",
        photos=photos_for([t for f in c["focus"] for t in services[f].get("tags", [])], exclude=c["image"], n=6),
        crumbs=[H, ("Service Areas", "/service-areas"), (county["name"], f"/service-areas/{c['county']}"),
                (c["name"], f"/service-areas/{slug}")],
        extra_schema=[faq_schema(c["faqs"])] if c.get("faqs") else [])

TAG_LABELS = {"chimneys": "Chimneys", "porches": "Porches", "steps": "Steps", "brick": "Brick", "stone": "Stone",
              "concrete": "Concrete", "driveways": "Driveways", "walkways": "Walkways", "pavers": "Pavers",
              "patios": "Patios", "retaining-walls": "Retaining walls", "foundations": "Foundations",
              "commercial": "Commercial", "residential": "Residential", "company": "Our crew"}
env.globals["tag_labels"] = TAG_LABELS
gallery_ids = [i for i in images]
filters = []
for k in ["chimneys", "porches", "steps", "brick", "stone", "concrete", "driveways", "walkways", "pavers", "patios",
          "retaining-walls", "foundations", "commercial", "residential"]:
    n = sum(1 for i in gallery_ids if k in images[i]["tags"])
    if n:
        filters.append((k, TAG_LABELS[k], n))
add("/gallery", "gallery.html", "Masonry Project Photos | Brick, Chimney & Concrete | Mr. Brick",
    "Photos of real Mr. Brick projects in Southeastern Michigan: chimney rebuilds, porches and steps, brick walkways, driveways, concrete and brick repair.",
    h1="Project gallery", lede="Real Mr. Brick jobs. Filter by the kind of work you're planning.",
    crumbs=[H, ("Projects", "/gallery")], gallery=gallery_ids, filters=filters,
    type="gallery", og_image_id="chimney-before-after", schema_type="CollectionPage")

add("/about", "about.html", "About Mr. Brick LLC | Family-Owned Masonry Contractor, Eastpointe MI",
    "Family-owned masonry contractor based in Eastpointe, serving Southeastern Michigan for 25+ years. Licensed, insured, 10-year warranty on new construction.",
    h1="Honest, practical and quick since day one", lede="A family-owned masonry contractor with more than 25 years of experience across Southeastern Michigan.",
    crumbs=[H, ("About", "/about")], hero_image="chimney-crew-scaffold", hero_cta=True, schema_type="AboutPage")

add("/reviews", "reviews.html", "Mr. Brick LLC Reviews | Masonry Contractor in Southeastern Michigan",
    "Read and leave reviews for Mr. Brick LLC, a family-owned masonry contractor serving Southeastern Michigan. See real project photos and our commitments.",
    h1="Reviews", lede="Real feedback from real customers — and our commitments to every one of them.",
    crumbs=[H, ("Reviews", "/reviews")], hero_cta=True)

add("/finance", "finance.html", "Masonry Financing Options | Mr. Brick LLC",
    "Financing is available on qualifying masonry and concrete projects from Mr. Brick LLC. Learn how it works and call to discuss your options.",
    h1="Financing for your masonry project", lede="Needed repairs shouldn't have to wait. Financing options are available on qualifying projects.",
    crumbs=[H, ("Financing", "/finance")], hero_image="brick-steps-dark-treads")

add("/special-offers", "offers.html", "Special Offers & Discounts | Mr. Brick LLC",
    "Current Mr. Brick masonry offers plus military, veteran, first responder and senior discounts. Mention your offer when you schedule a free quote.",
    h1="Offers and discounts", lede="Current promotions plus standing discounts for military, veterans, first responders and seniors.",
    crumbs=[H, ("Special Offers", "/special-offers")], hero_cta=True)

add("/faqs", "faqs.html", "Masonry FAQs | Cost, Timing, Warranty & Financing | Mr. Brick LLC",
    "Straight answers on masonry and chimney repair costs, project timing, concrete curing, tuckpointing, foundations, warranty and financing from Mr. Brick LLC.",
    h1="Frequently asked questions", lede="The questions we hear most, answered plainly.",
    crumbs=[H, ("FAQs", "/faqs")], faq_groups=FAQ_GROUPS, extra_schema=[faq_schema(faqs)])

add("/contact", "contact.html", "Contact Mr. Brick LLC | Call or Text (586) 209-3052",
    "Call or text Mr. Brick at (586) 209-3052 or send a quote request. Masonry contractor based in Eastpointe, serving Southeastern Michigan. Mon–Sat 8:30–6.",
    h1="Contact Mr. Brick", lede="Call, text, email or send a quote request — whatever's easiest for you.",
    crumbs=[H, ("Contact", "/contact")], schema_type="ContactPage")

add("/request-quote", "quote.html", "Request a Free Masonry Quote | Mr. Brick LLC",
    "Request a free, no-obligation quote for brick, chimney, porch, concrete or paver work in Southeastern Michigan. Three quick steps, photos welcome.",
    h1="Request a free quote", lede="Three quick steps. Add photos if you can — they help us give you a better first answer.",
    crumbs=[H, ("Request a Quote", "/request-quote")], type="quote")

add("/resources", "resources.html", "Masonry Guides for Michigan Homeowners | Mr. Brick",
    "Practical guides on brick, chimney, porch and concrete problems from a Southeastern Michigan masonry contractor with 25+ years of experience.",
    h1="Masonry guides for Michigan homeowners", lede="What to look for, what it means, and when to call a pro.",
    crumbs=[H, ("Resources", "/resources")], schema_type="CollectionPage")
for p in posts:
    add(f"/resources/{p['slug']}", "post.html", p["seo_title"], p["description"], h1=p["title"],
        lede=p["description"], post=p, og_type="article", lastmod=p.get("updated", p["date"]), og_image_id=p["image"], lcp_image=None,
        crumbs=[H, ("Resources", "/resources"), (p["category"], f"/resources/{p['slug']}")], type="post",
        extra_schema=[{"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"],
                       "description": p["description"], "datePublished": p["date"], "dateModified": p["date"],
                       "image": BASE + f"/static/img/{p['image']}-{images[p['image']]['jpg']}.jpg",
                       "author": {"@id": BIZ_ID}, "publisher": {"@id": BIZ_ID},
                       "mainEntityOfPage": url_of(f"/resources/{p['slug']}")}])

LEGAL = yaml.safe_load(open(C / "legal.yaml"))
for slug, L in LEGAL.items():
    add("/" + slug, "legal.html", L["title"], L["description"], h1=L["h1"], lede=L.get("lede", ""),
        body=markdown.markdown(L["body"].replace("{{PHONE}}", site["phone"]).replace("{{EMAIL}}", site["email"]).replace("{{UPDATED}}", "September 27, 2026")),
        lastmod="2026-09-27",
        crumbs=[H, (L["h1"], "/" + slug)])

add("/thank-you", "thank_you.html", "Thanks — We Got Your Request | Mr. Brick LLC",
    "Your quote request was sent to Mr. Brick LLC.", h1="Thanks — your request is in",
    lede="We'll be in touch soon to talk through your project.", noindex=True, type="thank-you")
add("/404", "404.html", "Page Not Found | Mr. Brick LLC", "The page you were looking for isn't here.",
    h1="That page isn't here", lede="Let's get you back on track.", noindex=True, type="404")

# ------------------------------------------------------------------ redirects (old URL -> new URL)
REDIRECTS = {
    "/specialty-masonry-services": "/brick-masonry",
    "/fireplace-repair": "/fireplace-services",
    "/fireplace-installation": "/fireplace-services",
    "/concrete-stair-installation": "/stair-services",
    "/stone-stair-installation": "/stair-services",
    "/stamped-concrete-patio-services": "/stamped-concrete",
    "/concrete-acid-staining": "/stamped-concrete",
    "/concrete-coating": "/concrete-sealing",
    "/concrete-demolition-services": "/concrete-services",
    "/driveway-resurfacing": "/driveway-repair",
    "/brick-walkway-installation": "/walkway-services",
    "/concrete-walkway-installation": "/walkway-services",
    "/paver-walkway-installation": "/walkway-services",
    "/brick-paver-services": "/paver-services",
    "/concrete-patio-installation": "/patio-services",
    "/stone-patio-installation": "/patio-services",
    "/foundation-installation": "/foundation-services",
    "/basement-waterproofing": "/foundation-services",
    "/retaining-wall-installation": "/retaining-wall-services",
    "/call-or-text-pop": "/contact",
    "/video-splash-pop": "/",
    "/3rd-party-video-splash-pop-02": "/",
    "/hibu-video-splash": "/",
    "/hibu-eng-menu": "/contact",
}

# ------------------------------------------------------------------ headers
# Written to dist/_headers (not netlify.toml) so they apply to Git deploys
# and to drag-and-drop zip deploys alike.
CSP = ("default-src 'self'; "
       "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://*.googleadservices.com https://*.doubleclick.net https://*.google.com; "
       "img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self'; "
       "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.doubleclick.net https://*.google.com https://*.googleadservices.com; "
       "frame-src https://www.googletagmanager.com https://*.doubleclick.net; "
       "form-action 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests")
HEADERS = f"""/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: {CSP}

/static/css/*
  Cache-Control: public, max-age=31536000, immutable
/static/js/*
  Cache-Control: public, max-age=31536000, immutable
/static/img/*
  Cache-Control: public, max-age=2592000
/static/fonts/*
  Cache-Control: public, max-age=2592000

/thank-you
  X-Robots-Tag: noindex
"""

# ------------------------------------------------------------------ build
def out_path(path):
    if path == "/":
        return DIST / "index.html"
    return DIST / (path.strip("/") + ".html")

def build():
    global ASSETS
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "static", DIST / "static", ignore=shutil.ignore_patterns("*.css", "*.js"))
    ASSETS.update(fingerprint())
    for rel, url in ASSETS.items():
        dest = DIST / url.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / "static" / rel, dest)
    shutil.move(str(DIST / "static/favicon.ico"), DIST / "favicon.ico")

    paths = {p["path"] for p in PAGES}
    for old, new in REDIRECTS.items():
        assert old not in paths, f"redirect source is a live page: {old}"
        assert new in paths, f"redirect target missing: {new}"

    for p in PAGES:
        schema = [business_schema(), WEBSITE]
        if not p.get("noindex"):
            schema.append(webpage_schema(p))
            if p.get("crumbs"):
                schema.append(crumbs_schema(p["crumbs"]))
        schema += p.get("extra_schema", [])
        p["schema"] = schema
        html_out = env.get_template(p["template"]).render(page=p, **{k: v for k, v in p.items() if k not in ("title",)})
        html_out = re.sub(r"\n\s*\n+", "\n", html_out)
        dest = out_path(p["path"])
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html_out)

    # sitemap
    urls = [p for p in PAGES if not p.get("noindex")]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p in urls:
        # lastmod only where we genuinely know it; a build date on every URL
        # teaches Google to ignore the field.
        lm = p.get("lastmod")
        sm.append(f"  <url><loc>{p['canonical']}</loc>" + (f"<lastmod>{lm}</lastmod>" if lm else "") + "</url>")
    sm.append("</urlset>")
    (DIST / "sitemap.xml").write_text("\n".join(sm) + "\n")
    (DIST / "robots.txt").write_text(f"User-agent: *\nDisallow: /thank-you\n\nSitemap: {BASE}/sitemap.xml\n")

    # redirects (Netlify). Old URLs with and without trailing slash; no chains.
    lines = ["# Generated by build.py — see docs/redirect-map.csv", "# old-site -> new-site (301)"]
    for old, new in REDIRECTS.items():
        lines.append(f"{old}  {new}  301")
        lines.append(f"{old}/  {new}  301")
    lines.append("/gallery/*  /gallery  301")
    (DIST / "_redirects").write_text("\n".join(lines) + "\n")

    (DIST / "_headers").write_text(HEADERS)

    (DIST / "site.webmanifest").write_text(json.dumps({
        "name": site["name"], "short_name": site["short_name"], "start_url": "/", "display": "browser",
        "background_color": "#25282b", "theme_color": "#25282b",
        "icons": [{"src": "/static/img/icon-192.png", "sizes": "192x192", "type": "image/png"},
                  {"src": "/static/img/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, indent=1))

    # docs: metadata map + redirect map
    docs = ROOT / "docs"
    docs.mkdir(exist_ok=True)
    with open(docs / "metadata-map.csv", "w") as f:
        f.write("url,title,title_len,description_len,h1,indexable\n")
        for p in PAGES:
            h1 = p.get("h1") or (p.get("svc") or {}).get("h1") or ""
            f.write(f'"{p["canonical"]}","{p["title"]}",{len(p["title"])},{len(p["description"])},"{h1}",{"no" if p.get("noindex") else "yes"}\n')
    with open(docs / "redirect-map.csv", "w") as f:
        f.write("old_url,new_url,status,reason\n")
        for old, new in REDIRECTS.items():
            reason = "legacy popup/vendor page" if "pop" in old or "hibu" in old else "thin page consolidated into stronger page"
            f.write(f"{BASE}{old},{BASE}{new},301,{reason}\n")
    print(f"built {len(PAGES)} pages, {len(REDIRECTS)} redirects -> {DIST}")

if __name__ == "__main__":
    build()
