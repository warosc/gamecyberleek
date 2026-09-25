# Cyberleek — Fuerzas de la Brecha

Original character designs generated for this project using the owner's Cyberleek hero and
BRÓK-9 as style references. The production files are real RGBA cutouts, not checkerboard concepts.

| File | Identity | Existing role |
| --- | --- | --- |
| radish.png | RÁB-01, soldado rábano | GRUNT: melee pursuer |
| carrot.png | ZAN-7, zanahoria velocista | RUNNER: fast, low-health pursuer |
| eggplant.png | BER-8, berenjena blindada | TANK: slow, high-health pursuer |
| tomato.png | TOM-4, tomate artillero | SHOOTER: kiting ranged attacker |

Runtime sizes and texture keys live in VegetableRoster.ts. VegetableVisual.ts animates one
painted sprite per enemy using gameplay time, with shared textures and a fixed child budget.
It adds whole-body stride, breathing, hit flashes, runner exhaust and gunner charge/recoil.
No limb articulation is claimed for these single-image assets. The existing geometric renderer
is retained as a missing-texture fallback. Health bars and elite labels sit above the artwork.

The menu's enemy archive and the battle use the same files. Asset tests cap individual PNGs at
2 MB, dimensions at 2048 px, and total uncompressed RGBA texture memory at 32 MiB.
