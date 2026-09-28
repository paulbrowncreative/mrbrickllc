"""Build responsive AVIF/WebP/JPEG variants from src-images/ using content/images.yaml.
Run when photos change: python3 tools/optimize_images.py
Writes static/img/<id>-<w>.<ext> and content/_image_manifest.json."""
import json, pathlib, yaml
from PIL import Image, ImageOps
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT/'src-images', ROOT/'static/img'
OUT.mkdir(parents=True, exist_ok=True)
WIDTHS = [480, 800, 1200, 1600]
cat = yaml.safe_load(open(ROOT/'content/images.yaml'))
manifest = {}
for iid, meta in cat.items():
    im = ImageOps.exif_transpose(Image.open(SRC/meta['src'])).convert('RGB')
    widths = [w for w in WIDTHS if w <= im.width] or [im.width]
    for w in widths:
        r = im.resize((w, round(im.height*w/im.width)), Image.LANCZOS)
        r.save(OUT/f'{iid}-{w}.avif', quality=40, speed=6)
        r.save(OUT/f'{iid}-{w}.webp', quality=66, method=6)
    w = min(1200, im.width)
    im.resize((w, round(im.height*w/im.width)), Image.LANCZOS).save(OUT/f'{iid}-{w}.jpg', quality=78, optimize=True, progressive=True)
    manifest[iid] = {'w': im.width, 'h': im.height, 'widths': widths, 'jpg': w, **meta}
json.dump(manifest, open(ROOT/'content/_image_manifest.json', 'w'), indent=1)
print(len(manifest), 'images')
