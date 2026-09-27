"""Import dedicated sprites for the later enemy families and sector commanders.

    python tools/art/import_sprites.py art-inbox/

Put transparent PNGs in the folder, named by role: medic.png, bulwark.png, brood.png, koli6.png,
romax.png (any subset). Each one is validated (must have real transparency), trimmed to its
visible pixels, padded, scaled to the production sprite size, written under public/assets/enemies
and registered in art-manifest.json. The game picks it up on the next load; roles without a
dedicated sprite keep the colour-graded fallback.
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MANIFEST = os.path.join(ROOT, 'public', 'assets', 'enemies', 'art-manifest.json')
# role -> (texture key, path under public/)
TARGETS = {
    'medic': ('vegetable-cabbage', 'assets/enemies/vegetables/cabbage.png'),
    'bulwark': ('vegetable-potato', 'assets/enemies/vegetables/potato.png'),
    'brood': ('vegetable-onion', 'assets/enemies/vegetables/onion.png'),
    'koli6': ('koli6-commander', 'assets/enemies/koli6/commander.png'),
    'romax': ('romax-commander', 'assets/enemies/romax/commander.png'),
}
# Matches the existing production sprites (about 1150 x 1370).
TARGET_HEIGHT = 1360
MAX_BYTES = 2_000_000


def process(source: str, destination: str):
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    transparent = sum(alpha.histogram()[:16]) / (image.width * image.height)
    if transparent < 0.05:
        raise ValueError('%s has no transparent background; remove the background first' % source)
    box = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if not box:
        raise ValueError('%s is fully transparent' % source)
    image = image.crop(box)
    pad = round(max(image.size) * 0.04)
    padded = Image.new('RGBA', (image.width + pad * 2, image.height + pad * 2), (0, 0, 0, 0))
    padded.paste(image, (pad, pad))
    # Scale down to the production size, never up: upscaling adds bytes, not detail.
    scale = min(1.0, TARGET_HEIGHT / padded.height)
    resized = padded.resize((max(1, round(padded.width * scale)), max(1, round(padded.height * scale))), Image.LANCZOS)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    resized.save(destination, optimize=True)
    size = os.path.getsize(destination)
    if size > MAX_BYTES:
        # Quantize large renders; the sprites are illustrated, so 256 colours hold up.
        resized.quantize(256, method=Image.Quantize.FASTOCTREE).save(destination, optimize=True)
        size = os.path.getsize(destination)
    return resized.size, size


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'art-inbox')
    with open(MANIFEST, encoding='utf-8') as handle:
        manifest = json.load(handle)
    sprites = {sprite['key']: sprite for sprite in manifest.get('sprites', [])}
    imported = 0
    for role, (key, path) in TARGETS.items():
        source = os.path.join(folder, role + '.png')
        if not os.path.exists(source):
            continue
        (width, height), size = process(source, os.path.join(ROOT, 'public', path))
        sprites[key] = {'key': key, 'path': path}
        imported += 1
        print('%-8s -> public/%s  %dx%d  %d KB' % (role, path, width, height, size // 1024))
    manifest['sprites'] = sorted(sprites.values(), key=lambda sprite: sprite['key'])
    with open(MANIFEST, 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=2)
        handle.write('\n')
    print('%d sprite(s) imported; manifest lists %d.' % (imported, len(manifest['sprites'])))


if __name__ == '__main__':
    main()
