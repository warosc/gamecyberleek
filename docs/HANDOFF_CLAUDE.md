# Claude game-feel handoff

Branch: `feature/game-feel-product`. Owned by the product/game-feel workstream.
Codex owns `feature/performance-runtime` and `docs/HANDOFF_CODEX.md`, which this workstream has
not edited.

Base: `main` at `c15d74e`. This branch does not contain Codex's performance-doc commits.

---

## 1. Branch incident — read this first

For part of this session both workstreams shared one working tree, and `feature/performance-runtime`
was the checked-out branch while game-feel commits were being made. Three game-feel commits landed
on top of Codex's three documentation commits.

This has been corrected and **nothing of Codex's was lost or rewritten**:

- `feature/performance-runtime` is reset to `20c933a`, byte-identical to `origin/feature/performance-runtime`.
- The three game-feel commits were rebased onto `main` and now live only on `feature/game-feel-product`.
- No game-feel commit was ever pushed to Codex's remote branch.

If Codex's local checkout looks unexpected, `git log --oneline feature/performance-runtime` should
show exactly `20c933a`, `3b8bd53`, `624d219` on top of `c15d74e`.

**Both agents share one working tree.** Check `git branch --show-current` before committing.

---

## 2. Defects fixed that were not cosmetic

### Every enemy spawned as an elite

`src/game/systems/SpawnSystem.ts` — a missing brace left `enemy.makeElite()` outside the elite
branch, so it ran unconditionally on every spawn from the first second of every run. Elites were
supposed to be capped at a 12% roll opening at 45 s.

Consequences: the crown and affix label communicated nothing, every grunt carried 1.5–2.8x health
and up to 1.45x damage, and the arena carried 80 crown `Graphics` objects plus 80 affix `Text`
objects that were never meant to exist.

**This is in a file Codex owns.** The change is a two-line brace fix, deliberately nothing else.
It is called out here because it materially changes both difficulty and the object count in every
performance measurement: **any baseline captured before `f4c59c9` measured a different game.**
Regression test: `tests/spawnSystem.test.ts`, verified by reintroducing the defect.

### The layered rig never played its one-shot animations

`LayeredPlayerRig` sampled its animations with absolute gameplay time, so for a non-looping clip
`Math.min(time, duration)` was already past the final keyframe a fraction of a second into any run.
Attack, dash, hurt and death were permanently pinned to their last pose and never animated.
Elapsed time is now measured from state entry (`RigAnimationClock`).

### Rig layers rotated about the wrong point

Every layer is a full-canvas 499×499 export, so a layer's texture centre is the middle of the
*body*, not of the part. Rotating a thigh swung it around the character's chest, which is why the
shipped keyframes could not exceed a few hundredths of a radian without the silhouette collapsing.
Layers now carry measured joint pivots and are posed through forward kinematics.

### Telegraphs did not precede damage

`Enemy.updateBehavior` fired the warning ring and the projectiles in the same frame. The telegraph
was decoration on top of instant damage, which section 13 of the product brief forbids.

### The boss health bar covered the run clock

`UIScene` drew the boss panel at y=88, across the timer and weapon readout, from the moment the
encounter that most needs a clock began.

---

## 3. New files

| File | Purpose |
| --- | --- |
| `src/game/entities/player/PlayerRigSkeleton.ts` | Joint pivots and parent links, measured from layer alpha |
| `src/game/entities/player/PlayerRigAnimation.ts` | Pure keyframe sampling + `RigAnimationClock` |
| `src/game/presentation/ImpactFeedback.ts` | Impact tier table and tier resolution (pure data) |
| `src/game/presentation/ImpactPresenter.ts` | Applies a tier across sparks, text, camera, audio |
| `src/game/audio/AudioEvents.ts` | Named audio event map with placeholder procedural voicing |
| `src/game/ui/RewardChooser.ts` | Shared level-up / chest cards, keyboard accessible |
| `src/game/ui/OnboardingHints.ts` | First-run control prompts |
| `src/game/systems/RunTelemetry.ts` | Local playtest instrumentation |

---

## 4. API and interface changes Codex must know about

### Preserved exactly

`Player`, `PlayerController`, `PlayerStats`, physics bodies and sizes, `PlayerVisualAdapter`,
`PlayerRigManifest`, the rig asset contract, `GAMEPLAY` pool caps, and `survivalMs` as the source
of gameplay timing. The fallback renderer still activates when any rig layer is missing.

### Added

- `PlayerVisualAdapter.setMotion?(vx, vy, dashing, moveSpeed)` — **optional**. An adapter that
  ignores it renders the same gameplay.
- `LayeredPlayerRig.setPowerGlow(intensity)` — sustained lens charge, used by Overdrive.
- `Enemy.flashHit(critical?)` and `Enemy.hit(amount, critical?)` — the second argument is
  presentation only.
- `Enemy.eliteColor` getter.
- `AudioManager.play(eventId)` — preferred over `tone()` at call sites. `tone()` gained optional
  `type` and `delayS` parameters and is otherwise unchanged.
- `CombatEffects.impact(x, y, tier?)`, `.deathBurst(x, y, color, tier?)`, `.damageNumber(...)`,
  `.xpPickup(x, y)`. `deathBurst`'s fourth parameter changed from `boss: boolean` to an
  `ImpactTier`; the only call site is `GameScene`.
- `GameScene.telemetry` — public `RunTelemetry` for the current run.
- `PlayerAnimator` exports `DASH_RECOVERY_MS`.

### New events

- `Events.PLAYER_DASHED` (`'player-dashed'`), emitted by `Player` with `(vx, vy)`. Consumed by
  `GameScene` for audio and `UIScene` for onboarding.
- `Events.PLAYER_DAMAGED` now carries an **optional third argument**: the damage actually applied
  after armor. Heals emit the same event without it. Existing two-argument listeners are unaffected.

### New configuration

- `GAMEPLAY.telegraphLeadMs = { shooter: 260, boss: 400 }` — warning time before a shot is
  released. Section 13 requires this to stay tunable. **No pool cap or budget was changed.**

### New debug key

`L` opens the level-up modal, gated by `VITE_DEBUG_GAME` exactly like the existing `B` and `C`.

---

## 5. Things Codex should NOT remove during optimization

1. **The telegraph lead time.** `Enemy.pendingAttack` resolves on `survivalMs`, deliberately not
   through `scene.time`, so a telegraph cannot fire while the run is paused or a modal is open.
   Collapsing it back to firing on the same frame restores unfair instant damage.
2. **Impact tier separation.** `IMPACT_PROFILES` is the difference between a graze and a boss kill.
   Scaling the whole table down uniformly is fine; flattening the tiers is not.
3. **The critical ring, elite/boss death ring, and boss phase callout.** These are the readability
   cues, not decoration. Per Codex's own handoff: degrade decoration, preserve telegraphs.
4. **The rig's forward-kinematics pass.** Layers must stay separate and pivots must stay on joints.
   Caching the solve is fine; flattening to one sprite loses every animation.
5. **Frame-rate-independent HUD interpolation** in `UIScene.update` — it uses `1 - exp(-delta/90)`
   so a 165 Hz and a 60 Hz display fill bars at the same speed.
6. **Reduced-motion paths.** `CombatEffects`, `ImpactPresenter` and `LayeredPlayerRig` each check
   `prefers-reduced-motion` independently.

---

## 6. Performance notes for Codex

Observations from this workstream, not optimizations:

- **Re-baseline after `f4c59c9`.** The elite fix removes up to 80 crown `Graphics` and 80 affix
  `Text` objects from a saturated arena. Any measurement taken before it is not comparable.
- **Per-frame object count added by this branch is small and bounded.** The rig adds one image
  (the additively blended glasses highlight). Impact tiers scale particle counts *within* the
  existing `maxTransientEffects` budget and the existing quality profile, never above it.
- **The dash trail is cheaper than it was.** One additive ellipse per 45 ms replaced one tinted
  full-body image, so at most ~4 are alive at once.
- **`Enemy.flashHit` adds a tween per hit and a ring per critical.** These are unpooled. If
  profiling shows tween churn under a saturated arena, this is the first place to look — the ring
  is already critical-only.
- **`showAttackTelegraph` now creates a nested tween** (contract, then release). Two tween objects
  per telegraphed attack instead of one.
- **`UIScene.update` reads `player.body.velocity` each frame** for the onboarding hint. It is a
  single vector read and stops mattering after two completed runs, but it is new work in a
  per-frame path.
- **Rig animation JSON is now ~15.5 KB against the 20 KB budget** asserted by
  `tests/playerRigAssets.test.ts`. Less headroom than before; the budget is unchanged.
- **`npm run test:e2e` completed all 9 scenarios in 3.8 minutes on this branch** (Chromium, WebKit,
  mobile WebKit, all passing). Codex's report records this as inconclusive; it now has a result.
- **Headless FPS is not a signal.** Headless Chromium reported 27–40 FPS on this machine with
  software rendering, matching Codex's 30.3 FPS average. This says nothing about real hardware.

---

## 7. Product findings this workstream could not fix in scope

**A new player very likely never sees a level-up.** Scripted runs that fire continuously,
kite, and use abilities died at 8–17 seconds while still at level 1. Level 2 costs 40 XP,
roughly four grunts, but XP orbs are only collected inside a 130 px magnet radius, and fleeing
abandons them.

This matters because the alpha's success condition depends on the player experiencing the reward
loop, and the level-up modal rebuilt in this branch is never reached. It is stated here rather than
acted on: balance belongs to Phase E, and the brief instructs this workstream not to redesign
combat stats. Note that difficulty is already substantially lower than shipped, because every
enemy used to be elite.

Recommended for a balance owner, in order: verify against human playtests before changing anything;
then consider a wider early magnet radius or a first-level XP cost below 40.

---

## 8. Verification run on this branch

| Check | Result |
| --- | --- |
| `npm run build` | PASS (known non-fatal 1.47 MB / 395 KB gzip chunk warning) |
| `npm run lint` | PASS |
| `npm run test` | PASS — 14 files, 61 tests (was 9 files, 25 tests) |
| `npm run test:e2e` | PASS — 9/9 across Chromium, WebKit, mobile WebKit, 3.8 min |

Beyond the automated checks, every change was inspected in the running game: idle, walk, dash,
attack, shield, overdrive, the boss entrance, both reward modals, desktop onboarding, and the
mobile touch HUD under iPhone 13 landscape WebKit.

No test was weakened. The two new regression suites were verified by reintroducing the real
defects: `tests/spawnSystem.test.ts` fails when the elite brace is removed, and
`tests/playerRigPlayback.test.ts` covers the absolute-vs-elapsed timing bug directly.
