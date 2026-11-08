"""Tell IndexNow search engines (Bing, Yandex, Seznam, Naver and others) about
the site's URLs. Run AFTER a deploy is live on the production domain:

    python3 tools/indexnow.py            # every URL in dist/sitemap.xml
    python3 tools/indexnow.py /blog /pool-deck-resurfacing   # just these paths

The key lives in content/site.yaml (indexnow_key) and build.py publishes it at
/<key>.txt so the engines can verify the ping. Google does not use IndexNow;
use Search Console for Google.
"""
import json, pathlib, re, sys, urllib.request
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
site = yaml.safe_load(open(ROOT / "content/site.yaml"))
base = site["base_url"].rstrip("/")
key = site["indexnow_key"]
if len(sys.argv) > 1:
    urls = [base + (p if p.startswith("/") else "/" + p) for p in sys.argv[1:]]
else:
    urls = re.findall(r"<loc>([^<]+)</loc>", (ROOT / "dist/sitemap.xml").read_text())
body = json.dumps({"host": base.split("://", 1)[1], "key": key, "keyLocation": f"{base}/{key}.txt",
                   "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                             headers={"Content-Type": "application/json; charset=utf-8"})
with urllib.request.urlopen(req, timeout=30) as r:
    print(r.status, f"submitted {len(urls)} URLs")  # 200/202 = accepted
