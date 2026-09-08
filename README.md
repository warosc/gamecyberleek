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
- Escape: pause

Switching windows or hiding the tab automatically pauses combat. Resume explicitly with Escape
or CONTINUAR. Gameplay timers and world animations also freeze during pause and reward selection.

Supply chests begin appearing during the run. Survive five minutes to summon BRÓK-9, the Broccoli Commander of the Breach, and defeat it to complete the mission. With `VITE_DEBUG_GAME=true`, press `C` to test a chest or `B` to summon the boss immediately.

Every third level drops a collectible equipment capsule. Weapons include pulse pistols, ARC blasters, ion lasers, and plasma cannons; armor provides HP, mitigation, movement, or dash upgrades. Equipment can roll Common, Rare, Epic, or Legendary rarity and remains active for the current run.

Weapons now have distinct behavior: ARC shots pierce, ion lasers penetrate multiple targets, and plasma rounds deal area damage. Elite enemies can appear later in a run, and marked bio-fuel barrels can be detonated to damage nearby enemies. The HUD tracks equipped weapon and armor.

Run results are saved locally as best level, victories, and bio-credits. Mobile players can toggle persistent auto-fire; compatible devices provide damage vibration feedback.

### Mobile controls

On touch devices, LEEK OPS displays a left movement joystick, a right aim/fire joystick, a dash button, and touch-enabled special ability buttons. The production build includes a web app manifest and service worker so supported browsers can install it as a landscape PWA.

## Architecture

### Animated presentation

The four common enemy roles now have original vegetable character art: RÁB-01 the radish soldier,
ZAN-7 the carrot runner, BER-8 the armored eggplant, and TOM-4 the tomato gunner. Open **ENEMIGOS**
from the main menu to inspect the roster and read its combat cues. Their existing hitboxes, damage,
spawn weights and attack timings are preserved. Each shared cutout texture is animated with body
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

Professional character rig and animation, audio, PWA/mobile controls, gamepads, additional arenas and bosses, then opt-in online/stream integrations. No backend or streaming integration is part of this milestone.
