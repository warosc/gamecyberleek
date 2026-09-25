# Physical-device profiling

The numbers in [combat-performance.md](combat-performance.md) come from browser emulation on the
development PC. They cannot tell us whether a real low-end phone holds its frame rate, gets hot, or
runs out of memory. This guide is the procedure for measuring that. It needs a person with the phone
in hand; nothing here can be automated from the repository.

## What we are trying to learn

1. Does a **production build** hold **30 FPS or better** through a full five-minute run on the target
   phone, including the boss fight?
2. How bad is the worst stretch: the p95 frame time in the 2:15–4:00 window, when the arena is at
   its enemy cap?
3. Does the phone throttle? Compare the FPS in minute one with the FPS in minute five.
4. How long does the first load take on a mid-range mobile connection?

## Target devices

Test on at least one of each:

| Tier | Example | Why |
|---|---|---|
| Low-end Android | 3–4 GB RAM, Snapdragon 6xx / Helio G-series, 2019–2021 | The floor we promise to support |
| Mid iPhone | iPhone 11–13 | Safari/WebKit, and the device most phone players will have |

Write the exact model, OS version and browser version into the results table.

## Setup

1. Build and serve production locally:
   ```sh
   npm run build
   npx vite preview --host 0.0.0.0 --port 8080
   ```
   The phone must be on the same Wi-Fi network. Open `http://<pc-ip>:8080`.
2. For numbers, build with the debug overlay enabled so FPS, entity counts and the quality tier
   are visible on screen:
   ```sh
   VITE_DEBUG_GAME=true npm run build && npx vite preview --host 0.0.0.0 --port 8080
   ```
   Do **not** ship this build: it enables the `B`/`C`/`L` debug keys.
3. Android: enable USB debugging, connect, and open `chrome://inspect` on the PC. Use the
   **Performance** panel to record 30-second traces and the **Memory** panel for a heap snapshot.
4. iPhone: enable *Web Inspector* in Safari settings, connect to a Mac, and use Safari's
   *Develop* menu → *Timelines*.

## Procedure

Run each step with the phone at room temperature, on battery, with brightness at 50%.

1. **Cold load.** Clear site data, reload, and time from tap to the main menu. Repeat three times.
2. **Full run, default settings.** Play a normal run in sector 1 to the boss. Note the overlay FPS
   at 0:30, 2:30, 4:00 (boss arrival) and during the boss's third phase.
3. **Peak load.** In the debug build, reach 2:15, then press `C` twice to add chests. Record a
   30-second performance trace.
4. **Thermal.** Play three runs back to back without a break. Compare minute-one FPS on run 1 and
   run 3.
5. **Quality tiers.** Repeat step 2 with *Ajustes → Calidad gráfica* set to `BAJA`. If the low tier
   does not hold 30 FPS, quality settings are not the lever and the entity budgets must come down.

## Results table

Copy this into a dated section at the bottom of this file.

| Device | OS / browser | Load (s) | FPS 0:30 | FPS 2:30 | FPS boss | p95 frame (ms) | Run-3 FPS | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | | |

## Decisions these numbers feed

- **Below 30 FPS at the cap on the low-end Android:** lower the ordinary-enemy cap (currently 32)
  and the transient-effect budget for the `low` tier, then re-measure.
- **Above 50 FPS everywhere:** there is headroom for the enemy-family density planned in
  `docs/ROADMAP.md` and for richer effects on `high`.
- **Load time above 8 s:** split the Phaser bundle and lazy-load the rig and boss art (see the
  roadmap's PWA/bundle item).
