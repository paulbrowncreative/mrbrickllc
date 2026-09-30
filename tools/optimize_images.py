"""Build responsive AVIF variants plus one JPEG fallback for NEW photos.

    1. Put the original photo in src-images/ (any size; JPG/PNG/HEIC exported to JPG).
    2. Add an entry to content/images.yaml:
         pool-deck-after: {src: pool-deck-after.jpg, alt: "Describe what the photo shows", tags: [concrete, patios]}
    3. python3 tools/optimize_images.py

Photos already in content/_image_manifest.json are skipped (their originals
aren't kept in the repo), but their alt text and tags are refreshed from
images.yaml, so editing a caption or tag never needs the original file.
Use --force <id> to rebuild one photo from its original.
AVIF covers every current browser; the JPEG is the fallback and share image.
Writes static/img/<id>-<w>.<ext> and content/_image_manifest.json."""
import json, pathlib, sys, yaml
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'src-images', ROOT / 'static/img'
MANIFEST = ROOT / 'content/_image_manifest.json'
WIDTHS = [480, 800, 1200, 1600]

force = set(sys.argv[sys.argv.index('--force') + 1:]) if '--force' in sys.argv else set()
cat = yaml.safe_load(open(ROOT / 'content/images.yaml'))
manifest = json.load(open(MANIFEST)) if MANIFEST.exists() else {}
OUT.mkdir(parents=True, exist_ok=True)

made, missing = [], []
for iid, meta in cat.items():
    if iid in manifest and iid not in force:
        manifest[iid].update(meta)          # keep alt/tags in sync
        continue
    src = SRC / meta['src']
    if not src.exists():
        missing.append(f"{iid}: {src.relative_to(ROOT)}")
        continue
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    widths = [w for w in WIDTHS if w <= im.width] or [im.width]
    for w in widths:
        r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        r.save(OUT / f'{iid}-{w}.avif', quality=40, speed=6)
    w = min(1200, im.width)
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(
        OUT / f'{iid}-{w}.jpg', quality=78, optimize=True, progressive=True)
    manifest[iid] = {'w': im.width, 'h': im.height, 'widths': widths, 'jpg': w, **meta}
    made.append(iid)

# Photos removed from images.yaml drop out of the site.
for iid in [i for i in manifest if i not in cat]:
    del manifest[iid]
json.dump(manifest, open(MANIFEST, 'w'), indent=1)
print(f"{len(made)} new: {', '.join(made) or '-'}; {len(manifest)} total")
if missing:
    sys.exit("Missing originals (add them to src-images/):\n  " + "\n  ".join(missing))
