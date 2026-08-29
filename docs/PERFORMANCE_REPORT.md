# LEEK OPS performance report

## Baseline

The repository currently has a desktop browser observation from the technical audit: a live run
held approximately 163–165 FPS with a worst observed frame of 8 ms at around 70 seconds. The
runtime caps 80 enemies, 90 player projectiles, 100 enemy projectiles, 160 XP orbs, and 180
transient effects.

Physical low-end Android/iPhone measurements are not yet available in this environment. The test
plan in `PERFORMANCE_TEST_PLAN.md` is the required procedure before claiming mobile gains.

## After optimization

| Metric | Baseline | After | Environment | Status |
| --- | --- | --- | --- | --- |
| Startup time | not measured | — | — | pending physical/automated capture |
| Average FPS | 163–165 observed | — | desktop browser | pending repeatable capture |
| 1% low frame time | not measured | — | — | pending |
| Worst frame | 8 ms observed | — | desktop browser | pending repeatable capture |
| JS heap / GC | not measured | — | — | pending |
| Texture memory | ~16 MB decoded rig estimate | — | desktop estimate | pending mobile capture |

## Current safeguards

- Projectile and XP pools are bounded and fail safely when exhausted.
- Transient effects have a shared budget and reduced-motion path.
- Quality profiles reduce decorative work only; damage, timing, spawn rules, and telegraphs are
  preserved.
- Scene shutdown removes registered listeners and owned visuals.

No optimization is considered complete until the same scenarios are measured again and visual
impact is recorded.
