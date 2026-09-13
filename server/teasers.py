"""Generate low-detail raster previews without exposing the source URL."""
import hashlib
import io
import re
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
FALLBACK = 'assets/codex/sealed.svg'


def make_teaser(db, source):
    if not isinstance(source, str):
        return FALLBACK
    upload = re.fullmatch(r'/api/images/([a-f0-9]{32})', source)
    local = re.fullmatch(r'assets/codex/[a-zA-Z0-9_-]+\.(?:png|webp|jpe?g|avif)', source)
    if upload:
        row = db.execute('SELECT body FROM images WHERE id=?', (upload[1],)).fetchone()
        raw = row['body'] if row else None
    elif local and (ROOT / source).is_file():
        raw = (ROOT / source).read_bytes()
    else:
        return FALLBACK
    if not raw:
        return FALLBACK
    image_id = hashlib.sha256(b'outlayer-teaser-v1\0'+raw).hexdigest()[:32]
    if db.execute('SELECT 1 FROM images WHERE id=?', (image_id,)).fetchone():
        return '/api/teasers/'+image_id
    try:
        with Image.open(io.BytesIO(raw)) as original:
            # Flatten transparency, crop like the card, remove fine detail before blurring.
            rgba = ImageOps.exif_transpose(original).convert('RGBA')
            base = Image.new('RGBA', rgba.size, '#171713')
            base.alpha_composite(rgba)
            image = ImageOps.fit(base.convert('RGB'), (800, 400), method=Image.Resampling.LANCZOS)
            image = image.resize((32, 16), Image.Resampling.BOX).resize((800, 400), Image.Resampling.BILINEAR)
            image = ImageEnhance.Brightness(image.filter(ImageFilter.GaussianBlur(24))).enhance(.72)
            output = io.BytesIO()
            image.save(output, 'WEBP', quality=75, method=4)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return FALLBACK
    db.execute('INSERT OR IGNORE INTO images VALUES (?, ?)', (image_id, output.getvalue()))
    return '/api/teasers/'+image_id
