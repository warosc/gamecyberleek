# Codex performance handoff

## Scope

Work for this mission belongs on `feature/performance-runtime`; do not commit performance work
directly to `main`. `docs/HANDOFF_CLAUDE.md` is owned by the parallel game-feel workstream and
must not be edited.

## Files and APIs to preserve

- `GAMEPLAY` pool caps and sector weights are the single source for budgets.
- `Player`, `PlayerController`, `PlayerStats`, and the layered rig adapter remain independent.
- The gameplay clock (`survivalMs`) remains the source for cooldowns/effects.
- `AudioManager` owns one shared `AudioContext`; new nodes must be short-lived and connected to
  the shared master gain.
- `CombatEffects` must preserve essential hit/death/boss telegraphs while degrading decoration.

## Findings

- The main Phaser bundle is approximately 1.46 MB minified / 395 KB gzip and currently emits a
  non-fatal Vite warning.
- Existing desktop observation is strong, but no physical low-end mobile baseline is recorded.
- Hot loops still use `getChildren().forEach()` and some dynamic transient text/effects; profile
  before replacing them.
- Rig layers are separate by design; do not flatten them into one sprite.

## Merge risks

- Changes to `GameScene` lifecycle or `UIScene` event wiring can reintroduce restart failures.
- Changing pool caps or gameplay constants changes game balance and requires product review.
- Any atlas/asset packing must retain the original separated rig sources and fallback renderer.

## G/H status

- Phase G (accounts, cloud saves, leaderboards, remote config) is pending provider selection,
  authentication, authorization, privacy/consent, rate limits, observability, backups, and a
  service-adapter boundary. Offline play must remain independent.
- Phase H (streaming interaction) is pending provider selection and a secure server queue with
  moderation, cooldowns, abuse prevention, broadcaster controls, and offline fallback. Provider
  secrets must never be shipped to the browser.

## Next measurement gate

Execute `PERFORMANCE_TEST_PLAN.md` on a real low-end Android device before changing hot loops,
texture loading, or pool sizes. Record results in `PERFORMANCE_REPORT.md` and keep product feel
reviewable for every visual or timing impact.
