"""Re-encode the heavy production PNGs as WebP, capped to the size they are ever drawn at.

    python tools/art/optimize_assets.py

The vegetable sprites and the commander were 1-1.8 MB PNGs of up to 1166x1536 pixels, drawn at
around 120 px in combat and 180 px in the bestiary. The caps below keep them sharp at the largest
on-screen size on a high-density phone while cutting download and decode time. Sources are
replaced in place (the .png is deleted), so re-running is a no-op.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / 'public' / 'assets'

# path (without extension) -> (max long edge, lossy quality)
TARGETS = {
    'enemies/vegetables/carrot': (640, 86),
    'enemies/vegetables/eggplant': (640, 86),
    'enemies/vegetables/radish': (640, 86),
    'enemies/vegetables/tomato': (640, 86),
    'enemies/brok9/commander': (900, 86),
    'character/leek/hero-clean-v2': (1000, 88),
    'ui/menu-backdrop': (1600, 76),
    'maps/cyber-vegetable-lab-floor': (1024, 80),
}


def main() -> None:
    for stem, (edge, quality) in TARGETS.items():
        source = ROOT / f'{stem}.png'
        target = ROOT / f'{stem}.webp'
        if not source.exists():
            print(f'{stem}: already optimised' if target.exists() else f'{stem}: MISSING')
            continue
        image = Image.open(source)
        image = image.convert('RGBA' if image.mode in ('RGBA', 'LA', 'P') else 'RGB')
        scale = min(1.0, edge / max(image.size))
        if scale < 1:
            image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        options = {'quality': quality, 'method': 6}
        if image.mode == 'RGBA':
            options['alpha_quality'] = 100
        image.save(target, 'WEBP', **options)
        before = source.stat().st_size / 1024
        after = target.stat().st_size / 1024
        print(f'{stem}: {before:.0f} KB -> {after:.0f} KB  ({image.width}x{image.height} {image.mode})')
        source.unlink()


if __name__ == '__main__':
    main()
