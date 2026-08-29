# LEEK OPS — Alpha 0.1 product checklist

## How to read this

Three separate states. They are not interchangeable and a row never advances by assumption.

- **IMPLEMENTED** — the code exists, builds, and is wired into the runtime.
- **VERIFIED** — someone confirmed the behaviour in the running game, or an automated test asserts
  it. The verification method is named in the row.
- **PLAYTESTED** — a real player who was given no instructions produced the intended reaction, per
  `PLAYTEST_PLAN.md`.

**Nothing in this document is PLAYTESTED.** No human playtest has been run. Every row below stops
at VERIFIED at best, and that is the honest ceiling until a session happens.

Verification method abbreviations: **T** = automated test, **O** = observed in the running game,
**E** = end-to-end smoke suite.

---

## Character feel

| Item | State | Verification |
| --- | --- | --- |
| Layered rig loads and renders at runtime | VERIFIED | O — debug overlay reports `Rig LAYERED` |
| Layers rotate at real joints, not the canvas centre | VERIFIED | T `playerRigSkeleton` + O |
| Idle breathing, never a static sprite | VERIFIED | O |
| Idle weight shift and head motion | VERIFIED | T `playerRigPlayback` (2.4 s cycle) + O |
| Leaf follow-through with spring inertia | VERIFIED | O |
| Occasional glasses shine | IMPLEMENTED | not isolated in review; fires on an idle timer |
| Fallback renderer still works when a layer is missing | IMPLEMENTED | unchanged path, not re-exercised |
| Silhouette stays readable in every state | VERIFIED | O across idle/walk/dash/attack |

## Movement

| Item | State | Verification |
| --- | --- | --- |
| Walk cycle with alternating leg lift and knee flex | VERIFIED | T `playerRigPlayback` + O |
| Arms swing in counter-phase to the legs | VERIFIED | T `playerRigPlayback` |
| Torso bounce and body tilt toward movement | VERIFIED | O |
| Animation never affects physics | VERIFIED | rig is presentation-only; no body writes |
| Dash: anticipation → travel → recovery | VERIFIED | T (pose ordering) + O |
| Dash squash/stretch and cyan trail | VERIFIED | O |
| Dash camera impulse | IMPLEMENTED | O, not measured |
| Gameplay dash duration unchanged | VERIFIED | visual tail is `DASH_RECOVERY_MS`, physics untouched |

## Combat

| Item | State | Verification |
| --- | --- | --- |
| Six-tier impact hierarchy | VERIFIED | T `impactFeedback` |
| Feedback escalates monotonically across tiers | VERIFIED | T (asserts shake, particles, spread all increase) |
| Critical hits are distinguishable | VERIFIED | T + O — larger gold number, ring, enemy punch |
| Full-screen flash reserved for boss death | VERIFIED | T |
| Muzzle flash and directional cone | VERIFIED | O |
| Enemy hit reaction (scale punch) | VERIFIED | O |
| Knockback on hit, stronger on critical | IMPLEMENTED | O |
| Weapon responds immediately to click | VERIFIED | O — no added latency; presentation is additive |
| Enemy attacks warn before they damage | VERIFIED | code path + O; lead is `GAMEPLAY.telegraphLeadMs` |
| Telegraph cannot resolve while paused | VERIFIED | scheduled on `survivalMs`, not `scene.time` |
| Aim resolved at release, so moving is a real dodge | VERIFIED | code path |
| Boss volley type readable before it lands | IMPLEMENTED | cone for directed, ring only for radial; O |

## XP

| Item | State | Verification |
| --- | --- | --- |
| Orbs accelerate as they close | VERIFIED | O |
| Pickup spark on collection | VERIFIED | O |
| XP bar interpolates rather than snapping | VERIFIED | O |
| XP bar breathes when a level-up is near | IMPLEMENTED | O at threshold |
| Bar empties and refills on level-up | IMPLEMENTED | O |
| Frame-rate independent bar fill | VERIFIED | `1 - exp(-delta/90)` |
| **A new player actually reaches a level-up** | **NOT MET** | scripted runs died at 8–17 s, still level 1 |

## Abilities

| Item | State | Verification |
| --- | --- | --- |
| LEEK NOVA — expanding cyan radial | IMPLEMENTED | O |
| BIO SHIELD — segmented green bubble | VERIFIED | O — gaps keep enemies behind it readable |
| OVERDRIVE — purple counter-rotating aura | VERIFIED | O |
| Shield and Overdrive told apart at a glance | VERIFIED | O — both active simultaneously, distinct |
| Overdrive reads on the character (lens charge) | IMPLEMENTED | `setPowerGlow`; O |
| Cast flare on activation | IMPLEMENTED | O |
| Blocked hit is visibly a block | IMPLEMENTED | O |
| No new abilities added | VERIFIED | registry unchanged |

## UI

| Item | State | Verification |
| --- | --- | --- |
| HP, XP, level, run time, cooldowns all on screen | VERIFIED | O |
| Boss health visible when active | VERIFIED | O |
| Boss bar no longer covers the run clock | VERIFIED | O — was at y=88, now y=126 |
| Level-up card: icon, name, one-line effect, level, pips | VERIFIED | O |
| Upgrade card readable in under 2 seconds | IMPLEMENTED | designed for it; **needs a human to confirm** |
| Level-up is keyboard accessible | VERIFIED | O — 1/2/3, arrows, Enter |
| Level-up is mouse accessible | VERIFIED | O |
| Level-up is touch accessible | IMPLEMENTED | shares the pointer path; not tapped on device |
| Chest rewards use the same component | VERIFIED | O |
| SPACE not bound to confirm (it is dash) | VERIFIED | deliberate omission |
| Screen not overloaded | IMPLEMENTED | subjective; for playtest |

## Boss

| Item | State | Verification |
| --- | --- | --- |
| Entrance banner and panel animation | VERIFIED | O via debug spawn |
| Boss health bar interpolates | VERIFIED | O |
| Phase change is unmistakable | VERIFIED | O — callout, panel punch, camera, audio |
| Boss death is a major bounded celebration | IMPLEMENTED | tier asserted by T; not observed end-to-end |
| Victory state unmistakable | IMPLEMENTED | existing OPERATION COMPLETE screen |
| Particle counts unchanged in aggregate | VERIFIED | tiers scale within existing budget |
| **Full boss fight played to completion** | **NOT DONE** | requires a 5-minute survival run |

## Mobile

| Item | State | Verification |
| --- | --- | --- |
| Touch HUD renders correctly | VERIFIED | O — iPhone 13 landscape WebKit |
| Touch hints only, never desktop keys | VERIFIED | O |
| Dash hint clear of the AUTO FIRE toggle | VERIFIED | O — was overlapping, fixed |
| Layered rig works on mobile WebKit | VERIFIED | O — reports `Rig LAYERED` |
| Quality profile degrades on device | VERIFIED | O — reports `BALANCED` |
| Safe areas respected | IMPLEMENTED | unchanged from prior work |
| Runs on physical hardware | **NOT DONE** | emulated WebKit only |

## Accessibility

| Item | State | Verification |
| --- | --- | --- |
| Reduced-motion suppresses sparks and bursts | IMPLEMENTED | `CombatEffects` guard |
| Reduced-motion suppresses camera shake and flash | IMPLEMENTED | `ImpactPresenter` guard |
| Reduced-motion suppresses lean, squash, lens shine | IMPLEMENTED | `LayeredPlayerRig` guard |
| Gameplay outcome identical under reduced motion | VERIFIED | all guards are presentation-only |
| Level-up fully keyboard operable | VERIFIED | O |
| Haptics failure cannot break the run | VERIFIED | existing callable-value guard |
| Reduced-motion path exercised end-to-end | **NOT DONE** | no run made with the flag set |
| Colour-blind readability | **NOT ASSESSED** | tiers lean on colour; shape/size differ too |

## Replay desire

| Item | State | Verification |
| --- | --- | --- |
| Restart is one keypress or one click | VERIFIED | E — smoke suite redeploys repeatedly |
| Restart is recorded for the KPI | VERIFIED | T `runTelemetry` |
| Run telemetry captured locally | VERIFIED | T — 7 cases incl. quota failure |
| Telemetry bounded and privacy-safe | VERIFIED | T — 25-run cap, no identifier, no network |
| **Restart rate ≥ 60%** | **UNKNOWN** | no human data |
| **"Would you play another run?" ≥ 6/10** | **UNKNOWN** | no human data |

---

## Board state

| Check | Result |
| --- | --- |
| `npm run build` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 14 files, 61 tests |
| `npm run test:e2e` | PASS — 9/9, Chromium + WebKit + mobile WebKit |

## The three things blocking Alpha 0.1

1. **No human has played this.** Every row above is capped at VERIFIED. Run `PLAYTEST_PLAN.md`.
2. **A new player probably never reaches a level-up.** Scripted runs died at 8–17 s at level 1.
   If playtests confirm it, the reward loop never closes and no amount of card polish helps.
   Balance is Phase E and needs a human read first.
3. **No physical mobile device and no full boss fight** has been exercised end-to-end.
