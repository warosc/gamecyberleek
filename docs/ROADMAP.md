# LEEK OPS Development Roadmap

This roadmap intentionally defers new content until the current vertical slice is stable and measurable.

## PHASE A — Stabilization

Goal: make existing behavior safe to extend.

Progress:

- [x] Extract keyboard/virtual input into `PlayerController`.
- [x] Move runtime abilities and projectiles to a pause-safe gameplay clock.
- [x] Introduce typed damage packets with damage type, source, critical, armor, and resistance fields.
- [x] Centralize enemy death resolution with a duplicate-resolution guard.
- [x] Add deterministic combat-pipeline and death-resolution tests.
- [ ] Split `GameScene` orchestration from world props, effects, and encounter flow.
- [ ] Split `UIScene` into focused components.
- [ ] Add Phaser scene restart/lifecycle integration tests.
- [ ] Convert equipment callbacks into structured modifiers.
- [ ] Profile target mobile hardware.

- Split `GameScene` orchestration from combat resolution, world props, effects, and encounter flow.
- Split `UIScene` into focused HUD/modal/mobile/debug components.
- Add scene lifecycle integration tests: repeated runs, pause/resume, level-up, death, victory, and menu transitions.
- Extend typed damage packets and centralized death resolution when statuses are introduced.
- Convert equipment to stable IDs, structured modifiers, and configurable rarity weights.
- Profile load time, frame time, memory, and garbage collection on desktop and low-end Android.
- Define supported entity budgets and degradation behavior.
- Add PWA icon validation and update/offline tests.

Exit criteria: all current checks pass, restart tests detect no duplicated listeners/timers, pause timing is deterministic, and target mobile hardware maintains the agreed frame budget.

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
