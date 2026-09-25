# Combat performance measurements

Measured on the Windows development host using Playwright, with Vite serving the game. This is
an automated stress scenario, not a physical PC/phone certification or a production benchmark.
Each load runs for 10 seconds after 1.5 seconds of warmup. The invulnerable stationary player fires
three projectiles every 90ms into mixed, animated enemies. Spawning and chests are disabled;
enemy behavior, collisions, impacts, telegraphs and rendering remain active. Counts above 32
intentionally bypass the production spawn cap. Different random combat histories make small
FPS differences noisy; this benchmark is not evidence of a precise performance gain.

Chromium reports ANGLE/SwiftShader: it renders WebGL in software. WebKit uses an iPhone landscape
profile on this same Windows host; its reported `Apple GPU` string does not mean a real Apple GPU
or physical iPhone was tested. No physical mobile device was available in this session.

| Browser profile | Enemies | Mean FPS | Frame p95 (ms) | Scene update p95 (ms) |
|---|---:|---:|---:|---:|
| desktop-chromium | 24 | 16.5 | 83.3 | 2.8 |
| desktop-chromium | 32 | 16.2 | 66.8 | 3.1 |
| desktop-chromium | 64 | 14.2 | 83.4 | 3.1 |
| mobile-webkit | 24 | 25.2 | 47.0 | 4.0 |
| mobile-webkit | 32 | 21.8 | 57.0 | 6.0 |
| mobile-webkit | 64 | 22.7 | 54.0 | 5.0 |

The scene-update metric spans Phaser preupdate through postupdate; it excludes rendering and
some other frame work. All measured loads completed without uncaught browser errors. These
results do **not** meet a 60 FPS target. Rendering/environment overhead is much larger than
scene-update time, so they cannot establish a safe physical-device enemy capacity.

## Capacity decisions

- Keep a provisional shared ceiling of **32 ordinary enemies**, with phase caps of 12, 20, 28,
  then 32. The same gameplay limit applies to desktop and mobile.
- At most **three ordinary attacks** can prepare/execute/recover simultaneously. Warnings remain
  visible at every quality level. Boss attacks have their own pattern and run after the crowd clears.
- CombatEffects tracks up to **96 / 72 / 48 objects** on high/balanced/low profiles. The balanced
  profile uses two baseline impact particles instead of three. This budget excludes fixed arena
  art, warning indicators, health bars and ability visuals; it is not a total display-object cap.
- Keep the existing projectile/orb pools: 90 player projectiles, 100 enemy projectiles, 160 XP orbs.
- Use these conservative limits until a production build is profiled on physical phones. Measure
  sustained play and thermals there before claiming 30/60 FPS or increasing density.

Reproduce: start `npx vite --port 5174 --strictPort`, then run
`node scripts/measure-combat.mjs`. JSON is in `docs/combat-performance.json`; screenshots are
written to `test-results/performance-*.png`. The script instruments only its test browser.
