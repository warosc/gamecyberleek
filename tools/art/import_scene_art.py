"""Import menu backdrops, sector floors and UI icons as compact WebP files.

    python tools/art/import_scene_art.py <inbox-folder>

Recognised files in the inbox (any subset, PNG or JPG):

    backdrop-<name>.png   -> public/assets/ui/backdrops/<name>.webp   (fitted to 1600x900, lossy)
    floor-<name>.png      -> public/assets/maps/<name>-floor.webp     (1024x1024, made to tile, lossy)
    icon-<name>.png       -> public/assets/ui/icons/<name>.webp       (128x128, transparent, lossless alpha)

Icons may come on a flat dark background: it is keyed out to transparency. Floors are made
seamless by cross-fading each edge with the opposite one, so a tileSprite shows no seams.
Every output is size-checked against a budget so the art never becomes a loading cost.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
BUDGET_KB = {'backdrop': 260, 'floor': 420, 'icon': 40}


def fit_cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def make_tileable(image: Image.Image, blend: int = 96) -> Image.Image:
    """Cross-fades a band along each edge with the wrapped-around opposite edge."""
    size = image.size
    shifted = ImageChops.offset(image, size[0] // 2, size[1] // 2)
    # Blend the original over its half-offset copy, keeping the original in the middle and the
    # offset copy (whose edges already wrap) near the borders.
    mask = Image.new('L', size, 0)
    px = mask.load()
    for y in range(size[1]):
        for x in range(size[0]):
            edge = min(x, y, size[0] - 1 - x, size[1] - 1 - y)
            px[x, y] = 255 if edge >= blend else int(255 * edge / blend)
    return Image.composite(image, shifted, mask)


def key_out_dark(image: Image.Image, threshold: int = 38) -> Image.Image:
    """Makes a flat near-black background transparent, with a soft edge."""
    rgba = image.convert('RGBA')
    luminance = rgba.convert('L')
    alpha = luminance.point(lambda v: 0 if v < threshold else min(255, (v - threshold) * 6))
    # Keep interior dark detail: fill holes by closing the mask.
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    rgba.putalpha(ImageChops.multiply(alpha, rgba.getchannel('A')))
    bbox = rgba.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    return rgba.crop(bbox) if bbox else rgba


def match_brightness(image: Image.Image, reference: Path) -> Image.Image:
    """Scales brightness to the lab floor's mean so enemies read the same on every sector."""
    from PIL import ImageStat, ImageEnhance
    target = ImageStat.Stat(Image.open(reference).convert('L')).mean[0]
    current = ImageStat.Stat(image.convert('L')).mean[0]
    # A touch above the lab floor: its dark navy reads brighter than the same mean in teal or green.
    return ImageEnhance.Brightness(image).enhance(min(1.0, target * 1.15 / max(current, 1)))


def trim(image: Image.Image) -> Image.Image:
    bbox = image.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    return image.crop(bbox) if bbox else image


def pad_square(image: Image.Image, size: int, margin: int = 6) -> Image.Image:
    inner = size - margin * 2
    scale = min(inner / image.width, inner / image.height)
    resized = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2), resized)
    return canvas


def save(image: Image.Image, target: Path, kind: str, **options) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, 'WEBP', method=6, **options)
    kb = target.stat().st_size / 1024
    status = 'ok' if kb <= BUDGET_KB[kind] else f'OVER BUDGET ({BUDGET_KB[kind]} KB)'
    print(f'{target.relative_to(ROOT)}  {image.width}x{image.height}  {kb:.0f} KB  {status}')
    if kb > BUDGET_KB[kind]:
        raise SystemExit(1)


def main(inbox: Path) -> None:
    for source in sorted(inbox.iterdir()):
        if source.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        kind, _, name = source.stem.partition('-')
        image = Image.open(source)
        if kind == 'backdrop':
            save(fit_cover(image.convert('RGB'), 1600, 900), ROOT / 'public/assets/ui/backdrops' / f'{name}.webp', kind, quality=74)
        elif kind == 'floor':
            tile = fit_cover(image.convert('RGB'), 1024, 1024)
            tile = make_tileable(match_brightness(tile, ROOT / 'public/assets/maps/cyber-vegetable-lab-floor.webp'))
            save(tile, ROOT / 'public/assets/maps' / f'{name}-floor.webp', kind, quality=78)
        elif kind == 'icon':
            transparent = image.mode == 'RGBA' and image.getchannel('A').getextrema()[0] < 250
            icon = trim(image) if transparent else key_out_dark(image)
            save(pad_square(icon, 128), ROOT / 'public/assets/ui/icons' / f'{name}.webp', kind, quality=88, alpha_quality=90)
        else:
            print(f'skipped {source.name}: unknown prefix')


if __name__ == '__main__':
    main(Path(sys.argv[1] if len(sys.argv) > 1 else 'art-inbox'))
