# LEEK OPS performance test plan

This plan is the gate for runtime optimizations. It measures frame pacing and memory without
changing combat rules or hiding essential telegraphs.

## Required environments

| Profile | Device/browser | Mode | Resolution | Notes |
| --- | --- | --- | --- | --- |
| Desktop baseline | Chromium, hardware acceleration on | Browser | Native | Record power/thermal state |
| Modern mobile | iPhone Safari or iOS PWA | PWA and browser | Landscape | Record battery and thermal state |
| Low-end target | Android device with 2–4 GB RAM, Chrome | PWA and browser | Landscape | Record battery and thermal state |

## Scenarios

Run each scenario for at least 60 seconds, then repeat the restart scenario ten times:

- A: normal minute one
- B: 80 active enemies
- C: 90 player projectiles
- D: 100 enemy projectiles
- E: high XP orb density
- F: boss fight with regular enemies present
- G: ten restart cycles through Game Over
- H: Nova, Shield, Overdrive and combat effects overlapping

Record average FPS, 1% low frame time, worst frame, JS heap trend (when available), GC
observations, entity counts, transient effects, and estimated texture memory. Do not use noisy
FPS assertions in CI; use deterministic pool and lifecycle guards instead.

## Acceptance targets

- Desktop: stable 60 FPS minimum; 120+ where browser/display allows.
- Modern mobile: 60 FPS target.
- Low-end Android: at least 45 FPS during sustained heavy gameplay.
- No monotonic listener, timer, physics-body, texture, AudioNode, or heap growth across ten
  restarts.

The degradation order is input, physics, combat, telegraphs, character animation, essential
VFX, decorative particles, background effects, then cosmetic trails.
