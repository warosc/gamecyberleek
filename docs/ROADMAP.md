# LEEK OPS Development Roadmap

This roadmap intentionally defers new content until the current vertical slice is stable and measurable.

## PHASE A — Stabilization

Goal: make existing behavior safe to extend.

### Why this phase is ordered the way it is

Three defects were found that each killed the game loop outright: a missing `Phaser` import
reached on every level-up, a `removeAllListeners()` that left the physics world null on every
restart, and an XP orb pool that silently stopped granting experience. `npm run build`,
`npm run lint` and `npm run test` were green through all three.

None of them would have been caught by splitting a scene. All of them would have been caught by
booting the real game and playing through level-up, death and restart. Verification therefore
comes first, and the refactors follow it.

### A0 — Verification (blocking) — COMPLETE

This gate is met; A1 is unblocked. Keep it green: a change that makes `npm run test:e2e` fail
on either browser is a change that ships a frozen game.

- [x] Browser smoke test (`npm run test:e2e`) that boots the real game in Chromium **and
      WebKit** and plays it: level-up and chest modals, taking damage, dying, and redeploying.
      Liveness comes from the telemetry the game already posts, so a silent freeze with no
      exception also fails the run. Both assertions were verified against the real defects by
      reintroducing them: the `navigator.vibrate` crash fails on WebKit, and the
      `removeAllListeners` crash fails the redeploy test.
- [x] Browser-to-terminal telemetry: uncaught errors, unhandled rejections, WebGL context loss
      and frame stalls are posted to the dev server and written to `.devlog.log`, tagged per
      device. This found every crash listed in the audit.
- [x] Fix the `AudioContext` leak. One shared context at game scope replaces one per run, and
      Phaser's own unused sound manager is disabled with `audio: { noAudio: true }`.
- [x] Guard the `Phaser`-as-global trap with an ESLint `no-restricted-globals` rule. ESLint does
      not read `.d.ts`, so an unimported `Phaser` is an unresolved global and is now an error,
      while an imported one is a local binding and passes.

### A1 — Structure

- [x] Extract keyboard/virtual input into `PlayerController`.
- [x] Move runtime abilities and projectiles to a pause-safe gameplay clock.
- [x] Introduce typed damage packets with damage type, source, critical, armor, and resistance fields.
- [x] Centralize enemy death resolution with a duplicate-resolution guard.
- [x] Add deterministic combat-pipeline and death-resolution tests.
- [x] Extract explosive world props from `GameScene` with owned physics/lifecycle.
- [x] Extract transient combat presentation into `CombatEffects`.
- [x] Extract deterministic arena presentation into `ArenaPresenter`.
- [ ] Finish splitting `GameScene`: extract loot/chests and encounter flow.
- [ ] Split `UIScene` into focused HUD, modal, pause, mobile-control and debug components.
- [ ] Convert equipment to stable IDs, structured modifiers, and configurable rarity weights.
- [ ] Extend typed damage packets and centralized death resolution when statuses are introduced.

### A2 — Measurement

Ranked below structure on evidence: a live run held 163-165 FPS with a worst frame of 8 ms at
70 seconds. A headless simulation of the real `SpawnSystem` does show the arena pinning at the
80-enemy cap from roughly the two-minute mark on a base damage build, so this is a real budget
question — but a profiling task, not an emergency.

- [ ] Profile load time, frame time, memory, and garbage collection on desktop and low-end Android.
- [ ] Define supported entity budgets and degradation behavior, as numbers.
- [ ] Add PWA icon validation and update/offline tests.
- [ ] Deferred, deliberately: close the remaining 18% of screen the canvas does not cover on a
      wide phone. Measured on iPhone 16 Pro Max, landscape, after fixing `viewport-fit` and
      `100dvh`: window 956x330, canvas 587x330, 61% coverage. Two independent losses —
      Safari's chrome takes 25% of the height (no Fullscreen API exists on iPhone, so only
      Add to Home Screen recovers it, reaching 82%), and the device's 2.17:1 does not match the
      game's 1.78:1. Closing the second means deriving the logical width from the device
      aspect, which widens the camera and lets a phone player see more arena than a desktop
      player. That is a balance decision, not a layout one.

### Exit criteria

Each of these must be answerable with a command or a recorded number, not a judgement:

1. `build`, `lint` and `test` pass.
2. The A0 smoke test completes ten consecutive runs with zero uncaught errors, including at
   least five restarts through the Game Over screen.
3. Restart leaves no duplicated listeners, timers or physics bodies, asserted by a test rather
   than inspection.
4. Pause timing is deterministic: gameplay clock, cooldowns and effect durations do not advance
   while paused or in a level-up.
5. A written frame budget exists, with a named target device, and that device meets it.

## PHASE B — Professional character animation

- Import a properly separated production rig or authored directional sprite sheets.
- Preserve `Player`, `PlayerController`, and physics APIs.
- Add idle, locomotion, attack, dash, hurt, and death state transitions.
- Validate animation memory and atlas loading on mobile.

Do not begin until Phase A exit criteria pass.

## PHASE C — Game feel / visual polish

- Original audio and dynamic mixing.
- Pooled impact/death effects, camera feedback, readable telegraphs.
- Accessibility options, quality presets, safe-area-aware mobile HUD.
- Final UI art and localization foundation.

## PHASE D — More enemies and boss behavior

- Data-driven enemy behaviors and elite affixes.
- Multi-phase Broccoli Commander encounter.
- Additional enemies only through profiled budgets.
- Explicit BOSS and VICTORY state transitions.

## PHASE E — Run progression and balance

- Structured weapon identities, damage types, statuses, armor and resistances.
- Tunable drop tables and rarity weights.
- Encounter pacing, difficulty curves, telemetry-ready balance events.
- Automated simulation/tests for XP and build progression.

## PHASE F — Persistent progression

- Versioned save schema and migration.
- Arsenal/unlock systems and accessibility settings.
- Optional account-ready repository boundary while retaining offline play.
- Data recovery and corruption handling.

## PHASE G — Online services

- Add a backend only for clearly defined requirements: accounts, cloud saves, leaderboards, remote configuration, or analytics consent.
- Authentication, authorization, rate limits, privacy, observability, backups, and deployment automation.
- Never make core offline combat dependent on service availability.

## PHASE H — Streaming interaction

- Opt-in audience events behind a secure server boundary.
- Moderation, cooldowns, abuse prevention, deterministic event queues, and broadcaster controls.
- Graceful fallback when streaming providers are unavailable.

No Phase B–H gameplay or service work is part of the current audit milestone.
