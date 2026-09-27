# Sprites for the later families and commanders

| Role | Sprite | Texture key |
|---|---|---|
| COL-3 medic | `vegetables/cabbage.png` | `vegetable-cabbage` |
| PAP-5 bulwark | `vegetables/potato.png` | `vegetable-potato` |
| CEB-9 brood | `vegetables/onion.png` | `vegetable-onion` |
| KOLI-6 commander | `koli6/commander.png` | `koli6-commander` |
| ROMA-X commander | `romax/commander.png` | `romax-commander` |

They were generated in Canva with the existing production sprites as style references (radish,
eggplant, tomato and BRÓK-9), with the background removed in Canva. The shipped files come from
Canva's preview export (about 200 px), which is enough at game scale: enemies display at
100–165 px and commanders at about 200–270 px.

`art-manifest.json` lists the sprites the game loads. A role missing from it falls back to its
base sprite under a colour grade, so removing an entry never breaks the game.

## Replacing a sprite with a full-resolution export

1. In Canva, open the image (Uploads, or the links in the session notes) and download it as a
   transparent PNG.
2. Save it into a folder named by role: `medic.png`, `bulwark.png`, `brood.png`, `koli6.png`,
   `romax.png`.
3. Run `python tools/art/import_sprites.py <folder>`. It checks the transparency, trims the
   image to its visible pixels, scales it to the production height (1360 px, never upscaling)
   and updates the manifest.
