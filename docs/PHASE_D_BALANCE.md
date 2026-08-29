# Phase D balance and performance contract

Phase D adds encounter variety without allowing unbounded runtime growth.

## Encounter rules

- Normal enemies use declarative `chase`, `kite`, or `commander` behaviors.
- Elite affixes are weighted per sector: early sectors favor `OVERCHARGED`, later sectors
  gradually introduce more `ARMORED` and `SWIFT` units.
- The Broccoli Commander has three health-based phases. Phase 2 alternates a directed fan
  with a radial ring; Phase 3 uses the denser high-pressure fan.
- A phase transition emits one visual/audio feedback pulse and never changes the run state twice.

## Runtime budgets

| Object | Cap | Policy when exhausted |
| --- | ---: | --- |
| Active enemies | 80 | Skip the spawn attempt |
| Player projectiles | 90 | Return no projectile |
| Enemy projectiles | 100 | Return no projectile |
| XP orbs | 160 | Reuse/skip according to pool policy |
| Transient effects | 180 | Skip decorative effect |

Adding a new enemy family is gated on a profile at 50, 100, 200, and 500 projectile stress
levels on a representative low-end mobile device. Content must not bypass these caps.
