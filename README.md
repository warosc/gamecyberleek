# LEEK OPS

A web-first 2D action roguelite vertical slice built with TypeScript, Phaser 4, Vite, and Docker. Survive neon bio-labs, defeat specialized enemies, collect XP, and build a run from randomized abilities and equipment drops.

A run is completed after surviving five minutes. Temporary Web Audio tones provide feedback without copyrighted external assets.

## Quick start

Requirements: Docker Desktop with Compose.

```sh
docker compose up --build
```

Open <http://localhost:5173>. Source is bind-mounted and Vite HMR is enabled.

For a local Node 22 workflow: `npm install`, then `npm run dev`. Available checks are `npm run build`, `npm run lint`, `npm run test`, and `npm run format`.

## Controls

- WASD or arrow keys: move
- Mouse: aim
- Left mouse: fire the LEEK BLASTER
- Space: dash
- Q: LEEK NOVA area attack
- E: BIO SHIELD temporary immunity
- R: OVERDRIVE damage and fire-rate boost
- I: inventory
- Escape: pause

**Gamepad** (standard mapping, e.g. Xbox or PlayStation): left stick or d-pad moves, right stick
aims and fires, right trigger fires, A / LB dash, X nova, Y shield, B / RB overdrive, Start
pauses, Back opens the inventory. Menus, level-up cards and results are navigated with the
stick/d-pad, A to confirm and B to go back.

Switching windows or hiding the tab automatically pauses combat. Resume explicitly with Escape
or CONTINUAR. Gameplay timers and world animations also freeze during pause and reward selection.

Supply chests begin appearing during the run. Survive five minutes to summon BRÓK-9, the Broccoli Commander of the Breach, and defeat it to complete the mission. With `VITE_DEBUG_GAME=true`, press `C` to test a chest or `B` to summon the boss immediately.

Every third level drops a collectible equipment capsule. Weapons include pulse pistols, ARC blasters, ion lasers, and plasma cannons; armor provides HP, mitigation, movement, or dash upgrades. Equipment can roll Common, Rare, Epic, or Legendary rarity and remains active for the current run.

Weapons now have distinct behavior: ARC shots pierce, ion lasers penetrate multiple targets, and plasma rounds deal area damage. Elite enemies can appear later in a run, and marked bio-fuel barrels can be detonated to damage nearby enemies. The HUD tracks equipped weapon and armor.

## Between runs (build 0.2.0)

- **Sectors**: pick any unlocked sector from the menu (arrows or ← →). Sector 2 pays ×1.25 and
  sector 3 ×1.5 bio-credits. Each sector has its own hazards, devices, objective, enemy families,
  music key and commander (BRÓK-9, KOLI-6, ROMA-X).
- **Taller / Workshop**: spend bio-credits on five permanent upgrades.
- **Operación diaria / Daily operation**: a date-seeded sector, weapon and modifier, scored and
  kept on a local top-5 board. The board goes through `src/game/online/OnlinePorts.ts`, whose
  default adapter is offline.
- **Registro / Records**: lifetime totals, the last 12 runs and 10 achievements with credit bonuses.
- **Ajustes / Settings**: graphics quality, motion, volumes, screen shake, vibration, language
  (Spanish / English), and export/import of the save file.

In-run statuses: *burn*, *chill* and *toxin* come from level-up options and the spore cannon.
The medic heals nearby enemies, the bulwark shields them, and the brood splits into runners.

Run results are saved locally (profile schema v5; older saves migrate automatically). Mobile players can toggle persistent auto-fire; compatible devices provide damage vibration feedback.

### Mobile controls

On touch devices, LEEK OPS displays a left movement joystick, a right aim/fire joystick, a dash button, and touch-enabled special ability buttons. The production build includes a web app manifest and service worker so supported browsers can install it as a landscape PWA.

Landscape phones use their full aspect ratio instead of shrinking a 16:9 canvas between side bars.
The gameplay camera is closer on touch devices so combatants remain legible, while the UI camera
stays at its original scale. Touch controls anchor to the device's logical edges and use compact,
translucent artwork to preserve visibility around the player.
On mobile, secondary operation and equipment labels are removed from the live HUD. Touch sticks
stay subdued while idle and brighten during interaction, keeping combat readable without hiding
the controls a player needs.

## Architecture

### Animated presentation

The four common enemy roles now have original vegetable character art: RÁB-01 the radish soldier,
ZAN-7 the carrot runner, BER-8 the armored eggplant, and TOM-4 the tomato gunner. Open **ENEMIGOS**
from the main menu to inspect the roster and read its combat cues. Their original art and hitboxes are retained; attack behavior and pacing now follow the five-minute combat slice. Each shared cutout texture is animated with body
sway/recoil and role-specific lighting; these are not separate-limb rigs. Decorative movement is
reduced on the low-quality profile, while attack warnings remain visible.

The layered player keeps a speed-driven walking cycle beneath sustained fire, with per-shot
arm/body recoil and subtle aim tracking. Enemies have articulated feet or fins, runner exhaust,
hovering shooters, charge/recoil cues, and a distinct broccoli commander with a rotating crown.
The arena includes specimen chambers, a segmented reactor, conduit pulses and drifting motes.
Ambient object counts are fixed; low-quality/reduced-motion profiles disable ambient movement.
BRÓK-9 uses original Cyberleek-style production artwork, an upright animated body and reactor/cannon
lighting across Contención, Sobrecarga and Ruptura. Defeating him freezes combat for the death effect
before the victory screen, preventing an XP reward modal from interrupting completion.
`tests/e2e/animation.spec.ts` checks moving while firing, pause, reduced motion and scene restart
in desktop and mobile browsers, and saves a screenshot of the animated arena.

Scenes own lifecycle and presentation. `Player`, `Enemy`, and projectile classes own entity behavior; systems handle spawning, combat math, and XP; abilities are data-driven. Gameplay/UI communicate via scene events. Fast-spawned projectiles use an Arcade Physics pool.

The character uses a validated 16-layer production rig with data-driven idle, walk, attack, dash,
hurt, and death keyframes. A complete-reference fallback remains available if a rig texture is
missing; no frames are synthesized or distorted. The runtime Player API remains independent from
rendering so the rig can evolve without changing gameplay. See `public/assets/character/leek/README.md`.

Copy `.env.example` to `.env` and set `VITE_DEBUG_GAME=true` to show FPS, entity counts, player coordinates, and the current game state.

## Extending the game

To add an enemy, add its enum and data in `EnemyTypes.ts`; `EnemyFactory` remains the sole construction point. To add an ability, append an `Ability` definition to `AbilityRegistry.ts`. To add animation, load separated layer textures during Boot/Preload and bind them inside `Player` while retaining its physics container and controller API.

## Production

```sh
docker build -f Dockerfile.prod -t leek-ops:prod .
docker run --rm -p 8080:80 leek-ops:prod
```

The production image builds with Node 22 and serves `dist` from nginx.

## Dev Container and troubleshooting

Use **Dev Containers: Reopen in Container** in VS Code. If HMR stalls on Windows, ensure Docker file sharing permits this repository. If port 5173 is occupied, stop the other service before starting Compose.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md). Open items need people or decisions rather than code: a
human playtest round ([docs/PLAYTEST_PLAN.md](docs/PLAYTEST_PLAN.md)), profiling on physical
phones ([docs/DEVICE_PROFILING.md](docs/DEVICE_PROFILING.md)), dedicated art for the new enemy
families and commanders, recorded audio, and a backend choice for online leaderboards and cloud saves.

## Continuous integration

`.github/workflows/ci.yml` runs lint, build and unit tests, then the Playwright suite on
chromium, webkit and mobile-webkit, for every pull request and push to `main`.


## Combat slice: expressive movement and readable attacks

The player carries an aim-aligned pulse weapon with recoil and a matching muzzle origin. Walking
continues underneath firing. Dash commits to its initial direction for 150ms and avoids damage
during the impulse; a taken hit grants 350ms protection against stacked damage.

Radishes pursue, warn for 500ms, then lunge into a short melee window. Carrots mark a 286px lane,
wait 700ms, charge along that fixed direction, and recover. Tomatoes stop and mark their firing
line for 650ms, then fire along that line. Up to three ordinary attacks can prepare simultaneously.
Critical impacts retain camera feedback; ordinary hits use local effects and sound. Knockback is
bounded and does not displace an enemy while it is committing to a marked attack.

The run introduces pursuit at 0:00, charges at 0:30, ranged fire at 1:15, and mixed formations at
2:15. At 1:00, 2:00 and 3:00, choose piercing shots, an extra projectile or a faster dash.
BRÓK-9 arrives at 4:00 and clears the previous wave. Five minutes is the intended completion time,
not an automatic win: the boss must be defeated, and the timer can exceed 5:00.

See [combat performance measurements](docs/combat-performance.md) for capacities, methodology and
emulation limits. Reproduce with Vite running on port 5174 and `node scripts/measure-combat.mjs`.
