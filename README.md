# mrbrickllc.com

A static site for Mr. Brick LLC, deployed on Netlify.

## Edit content
| What | Where |
|---|---|
| Phone, hours, social links, promotions, GTM ID | `content/site.yaml` |
| Services (27 pages) | `content/services.yaml` |
| County pages | `content/areas.yaml` |
| General FAQs | `content/faqs.yaml` |
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

## Docs
`docs/` contains the launch report, analytics event map, redirect map, URL inventory and metadata map.
