# LEEK OPS performance report

## Baseline

The repository currently has a desktop browser observation from the technical audit: a live run
held approximately 163–165 FPS with a worst observed frame of 8 ms at around 70 seconds. The
runtime caps 80 enemies, 90 player projectiles, 100 enemy projectiles, 160 XP orbs, and 180
transient effects.

Physical low-end Android/iPhone measurements are not yet available in this environment. The test
plan in `PERFORMANCE_TEST_PLAN.md` is the required procedure before claiming mobile gains.

## Automated verification (2026-08-29)

- `npm run build`: PASS; Vite reports the known non-fatal ~1.47 MB minified / ~395 KB gzip
  bundle warning.
- `npm run lint`: PASS.
- `npm run test`: PASS; 9 files and 25 tests.
- `npm run test:e2e`: started all 9 configured scenarios (Chromium, WebKit, mobile WebKit), but
  the interactive runner exceeded the session capture window before printing its final summary.
  This is recorded as **inconclusive**, not a pass; rerun it in a full terminal before merging.

Telemetry captured while the Chromium scenario was running produced 167 performance samples:
average 30.3 FPS, minimum 13 FPS, maximum 60 FPS, and a worst observed frame of 91 ms. This is
an automated/headless baseline only (likely software rendering), not evidence of physical mobile
performance and not a reason to lower gameplay budgets.

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
