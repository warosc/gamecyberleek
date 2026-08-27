# LEEK OPS Technical Audit

Audit date: 2026-08-27

## Executive summary

LEEK OPS is a functional Phaser 4 vertical slice. Dependency installation, TypeScript production build, ESLint, Vitest, and Docker Compose build all pass. The documented gameplay loop exists and no README feature is missing or broken after the safe fixes made during this audit.

The repository is suitable for a stabilization/animation milestone, but not yet for uncontrolled content expansion. The main risks are oversized scene classes, presentation and domain logic mixed in `GameScene`, only six unit tests, non-declarative equipment modifiers, and unpooled transient visual effects. Runtime capacity is intentionally capped at 80 enemies, 90 player projectiles, 100 enemy projectiles, and 160 XP orbs.

## Build status

| Check | Result | Notes |
| --- | --- | --- |
| `npm install` | PASS | 161 packages audited; 0 reported vulnerabilities |
| `npm run build` | PASS | TypeScript and Vite production build succeed |
| `npm run lint` | PASS | No ESLint findings |
| `npm run test` | PASS | 2 files, 6 tests |
| `docker compose build` | PASS | Node 22 Alpine development image builds |

Vite reports a non-fatal large-chunk warning: the main Phaser bundle is approximately 1.44 MB minified / 389 KB gzip.

## Feature verification

Status meanings: **IMPLEMENTED** works in source and is connected to the runtime; **PARTIAL** exists with an important limitation; **MISSING** has no implementation; **BROKEN** exists but fails its intended flow.

| Feature | Status | Evidence / limitation |
| --- | --- | --- |
| WASD movement | IMPLEMENTED | `PlayerController` maps W/A/S/D and provides normalized movement |
| Mouse aiming | IMPLEMENTED | `Player.update()` converts the active pointer through the world camera |
| Left-click shooting | IMPLEMENTED | Desktop firing uses `pointer.isDown` |
| Dash | IMPLEMENTED | Space/mobile dash, cooldown, duration, speed, and trail exist |
| LEEK NOVA | IMPLEMENTED | Q/mobile activation, cooldown, area hit, boss interaction |
| BIO SHIELD | IMPLEMENTED | E/mobile activation and damage immunity window |
| OVERDRIVE | IMPLEMENTED | R/mobile activation, damage and fire-rate modifiers |
| Pause | IMPLEMENTED | Escape and HUD button; physics and gameplay clock pause |
| XP | IMPLEMENTED | Pooled XP orbs, magnet collection, thresholds and remainder |
| Level-up upgrades | IMPLEMENTED | Random cards, levels, caps, stat application |
| Supply chests | IMPLEMENTED | Timed spawn, collision, three reward choices |
| Equipment drops | IMPLEMENTED | Every configured third level; physical collectible |
| Equipment rarity | IMPLEMENTED | COMMON/RARE/EPIC/LEGENDARY centralized in `Equipment.ts` |
| Broccoli Commander | IMPLEMENTED | Dedicated boss definition, spawn event, radial attack and boss HUD |
| 5-minute run timer | IMPLEMENTED | `RUN_DURATION_MS = 5 * 60 * 1000` using gameplay time |
| Victory condition | IMPLEMENTED | Boss death schedules one guarded victory transition |
| Debug mode | IMPLEMENTED | Compile-time `VITE_DEBUG_GAME` gate and runtime overlay |
| Debug C command | IMPLEMENTED | Debug-only chest spawn |
| Debug B command | IMPLEMENTED | Debug-only boss spawn with duplicate guard |
| Mobile movement joystick | IMPLEMENTED | Dedicated left pointer and normalized vector |
| Mobile aiming/fire joystick | IMPLEMENTED | Independent pointer ID, aim vector, firing state |
| Mobile dash | IMPLEMENTED | Separate touch target |
| Mobile ability buttons | IMPLEMENTED | Q/E/R buttons call the same ability API |
| PWA manifest | IMPLEMENTED | Standalone landscape manifest and character icon |
| Service worker | IMPLEMENTED | Production-only registration, network-first cache, immediate update activation |
| Character directional rendering | PARTIAL | Front/profile/back supplied poses are selected correctly, but they are reference poses rather than a separated production rig |
| Projectile pooling | IMPLEMENTED | Player and enemy projectile Arcade groups have configured maximum sizes |

## Architecture findings

### Structure

- `GameScene.ts` is oversized at roughly 650 lines. It owns orchestration, combat resolution, arena decoration, loot, barrels, boss flow, effects, chests, and transitions.
- `UIScene.ts` is oversized at roughly 575 lines. HUD, modal cards, pause menu, mobile controls, debug UI, and loot notifications should eventually be separate components.
- A `PlayerController` was extracted during this audit. `Player` remains responsible for entity state/effects and `PlayerAnimator` remains replaceable.
- No runtime circular dependency was identified. `UIScene` imports `GameScene` as a type only.
- No explicit `any` usage was found. Phaser callback boundaries require several casts; most are localized but are not runtime-validated.
- Naming is generally consistent. Mixed English/Spanish display strings do not affect architecture but should be localized later.

### State management

- Explicit states exist for MENU, PLAYING, PAUSED, LEVEL_UP, and GAME_OVER.
- Boss and victory are represented through `bossSpawned`, delayed callbacks, and transition data rather than explicit BOSS/VICTORY states. This is workable for the slice but should be formalized before adding multi-stage bosses.
- `pausedByEsc`, `bossSpawned`, and `pendingEquipmentDrop` are reset in `init()`.

### Lifecycle

- `GameScene` clears scene-event and keyboard listeners on shutdown.
- `UIScene` unsubscribes from all `GameScene` events; the previously omitted `STATE_CHANGED` listener was fixed during this audit.
- Phaser owns and destroys scene timers, colliders, input plugins, tweens, and display-list objects at scene shutdown.
- Equipment drops and enemies destroy their auxiliary visuals explicitly.
- Infinite decorative/drop tweens are scene-owned and stop at scene shutdown. No cross-scene timer was found.
- `AudioManager` creates a scene-scoped one-time unlock listener. The Web Audio context is not explicitly closed, but only one context is normally created per run after interaction; centralizing audio at game scope is recommended.

## Performance findings

### Current bounded capacity

| Runtime object | Current behavior |
| --- | --- |
| 50 enemies | Supported; normal target range |
| 100 enemies | Not reached: spawning caps at 80 |
| 200 enemies | Not supported by current design |
| 500 player projectiles | Not reached: pool caps at 90 |
| Enemy projectiles | Pooled, cap 100 |
| XP orbs | Pooled, cap 160 |

- Player and enemy projectiles and XP orbs are pooled.
- Enemies, equipment drops, damage numbers, muzzle flashes, impact dots, dash ghosts, and explosion graphics are allocated dynamically.
- Every active enemy, projectile, and orb is iterated each gameplay frame. At current caps this is acceptable, but collision broad-phase and per-enemy multi-object visuals will dominate before raw update code.
- `PlayerController` now reuses its movement vector, removing a per-frame vector allocation.
- Impact effects create five circles plus tweens per hit. This is the clearest transient allocation hotspot.
- Floating damage text is unpooled and can produce GC pressure under rapid/multishot builds.
- Projectile pools fail safely when exhausted by returning no projectile; this limits output instead of growing memory.
- `getChildren().forEach()` callbacks allocate closures/iterator work each frame. This is measurable only after profiling and should not be rewritten blindly.

## Player architecture

Current separation:

- `Player`: physics entity, health interaction, weapon cadence, dash and temporary effects.
- `PlayerController`: keyboard/virtual input normalization and dash intent.
- `PlayerStats`: mutable run statistics.
- `PlayerAnimator`: supplied-pose rendering adapter.
- Ability definitions/effects: split between data registries and scene activation.

Replacing the character rig should remain confined primarily to `PlayerAnimator` and Player visual construction. Remaining debt: temporary shield/overdrive effects still live in `Player`; a future `StatusEffectController` is appropriate, but is not required yet.

## Combat architecture

The effective pipeline is now:

`Player attack -> pooled projectile -> Arcade overlap -> DamagePacket/resolveDamage -> HealthComponent -> EnemyDeathResolver -> death event/reward`

`CombatSystem` supports typed source, damage type, critical multiplier, armor, and resistance. `EnemyDeathResolver` guarantees one destruction/reward result for projectile, Nova, plasma, and environmental kills. Plasma area targeting and Nova presentation remain in `GameScene`. Before status effects, extend `DamagePacket` with a typed status payload rather than branching inside weapon definitions.

## Equipment system

- Rarity names, colors, multiplier selection, and drop generation are centralized.
- Equipment definitions include name, kind, rarity, description, color, and an `apply` callback.
- The system is only partially data-driven: definitions lack stable IDs, structured stat modifiers, and explicit weights. Each item embeds custom mutation logic.
- Rarity thresholds are centralized but hard-coded inside `rollRarity`; they should become configurable weighted data before balance work.
- Current equipment modifies run-local stats and tracks one displayed weapon/armor slot; it is not a general inventory persistence model.

## Ability review

- Cooldowns are centralized in `SpecialAbilities.ts`.
- Nova, Shield, and Overdrive share one activation gate and cooldown map.
- During this audit, ability and projectile timing was moved from Phaser wall-clock time to `survivalMs`. Pause and level-up selection no longer consume cooldowns or effect duration.
- Shield logic blocks damage before armor and health calculation.
- Repeated shield activation extends logical duration. Its visual visibility is now synchronized to logical gameplay time.
- Repeated Overdrive activation extends logical duration without stale delayed callbacks resetting its visual scale.
- Nova can kill the boss and enters the guarded victory path.
- Scene shutdown cancels scene-owned delayed victory/effect callbacks.

## Boss review

- The boss spawns after the configured five-minute survival threshold.
- `bossSpawned` prevents timer and debug duplicate spawns.
- Normal spawning stops when the boss appears; already-active enemies remain and continue behaving.
- Boss death invokes victory once through `gameOver()`'s GAME_OVER guard.
- Player death and victory cannot both transition: the first transition changes state, and scene shutdown destroys remaining scene timers.
- `init()` resets boss state on every run.
- Risk: no explicit BOSS/VICTORY states and boss combat is implemented inside the general `Enemy` class.

## Mobile review

- Mobile controls appear only when touch/coarse-pointer detection succeeds.
- Four active pointers allow movement, aiming, dash, and ability interaction together.
- Pointer IDs separate movement and aim.
- `touch-action: none`, fixed body layout, disabled overscroll, and captured Phaser touch input prevent browser gestures.
- Pointer-up and game-out reset movement/firing to prevent stuck input.
- Portrait coarse-pointer devices receive a landscape orientation prompt.
- Controls use fixed logical 1280x720 coordinates and Phaser FIT scaling. They scale uniformly with the canvas but do not account individually for notches/safe-area insets.

## PWA review

- Manifest exists, uses standalone landscape display, theme colors, and a character PNG.
- Service worker registration is production-only.
- Fetch handling is network-first with cache fallback, reducing stale-development risk.
- Cache version was incremented and `skipWaiting()`/`clients.claim()` added during this audit so production updates activate promptly.
- Remaining limitation: no dedicated validated 192x192 and 512x512 icon set, no offline fallback page, and no automated PWA audit.

## Configuration review

Run duration, ability cooldowns, enemy definitions, arena themes, and XP formula were already centralized. During this audit, pool limits, chest timing, equipment interval, spawn intervals, and elite timing/chance were consolidated in `GAMEPLAY` configuration.

Remaining magic values include weapon/effect durations, boss attack cadence, shooter ranges, projectile lifetimes, barrel values, and individual visual timings. Move them only when their owning subsystem is extracted.

## Debug tools

Debug mode remains completely gated by `VITE_DEBUG_GAME === 'true'`. The overlay now reports FPS, enemy/projectile/orb counts, HP, player position, current state, elapsed run time, weapon, and active Shield/Overdrive effects. B and C remain debug-only.

## Lifecycle risks

1. Scene classes still own many anonymous physics callbacks; Phaser cleans them with the scene, but isolation testing is difficult.
2. Delayed victory is safe today but should become an explicit transition if boss phases are added.
3. Audio context ownership should move to a game-level service before multiple scenes play music.
4. UI input callbacks depend on scene-plugin shutdown cleanup rather than individually stored callback references.

## Technical debt and priorities

### High priority

1. Split `GameScene` into combat/death resolution, encounter/boss flow, world props, and effects services.
2. Add integration tests for scene restart, player death versus boss death, pause timing, and equipment collection.
3. Add typed status payloads to `DamagePacket` before implementing status effects.
4. Profile on representative low-end Android hardware before increasing caps.

### Medium priority

1. Split `UIScene` into HUD, modal selection, pause, mobile controls, and debug overlay.
2. Convert equipment `apply` functions into stable IDs plus structured modifiers and configurable rarity weights.
3. Pool damage numbers, impact dots, and dash ghosts if profiling shows GC spikes.
4. Add explicit BOSS and VICTORY states.
5. Centralize audio lifecycle and add real licensed/original assets.

### Low priority

1. Code-split or tune bundling after measuring load time; Phaser dominates the current bundle.
2. Add dedicated PWA icon sizes and automated Lighthouse checks.
3. Add localization for mixed display languages.
4. Replace remaining magic visual timings during subsystem extraction.

## Major bugs fixed during audit

- Gameplay cooldowns, shield, Overdrive, enemy attack timers, and projectile lifetimes no longer advance during pause or level-up screens.
- Re-activating Shield/Overdrive no longer leaves visuals out of sync due to stale delayed callbacks.
- Missing UI state-listener cleanup was added.
- Per-frame player movement vector allocations were removed through `PlayerController`.
- Service-worker updates activate immediately and take control of open clients.
- Important operational limits/timings were moved to configuration.

## Recommended next milestone

Proceed with **Phase A: Stabilization** only. Add lifecycle/integration tests, split oversized scenes, formalize combat packets and equipment data, and profile mobile hardware. Begin professional character animation only after Phase A acceptance criteria in `ROADMAP.md` pass.
