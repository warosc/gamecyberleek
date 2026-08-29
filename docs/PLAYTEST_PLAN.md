# LEEK OPS playtest plan — Alpha 0.1

## What this test is for

One question decides whether the alpha is working:

> **Did that feel good enough that I want another run?**

Everything below exists to answer it with observation and recorded behaviour instead of opinion.

## Success condition being tested

A completely new player opens the game without instructions, understands what to do, survives or
dies, and **voluntarily** presses restart.

## Participants

5–10 players. Recruit for a mix of:

- 2–3 who play action roguelites regularly (Vampire Survivors, Brotato, Hades)
- 3–4 who play games casually but not this genre
- 1–2 who rarely play games at all

At least two sessions on a phone. The touch build is a different product and cannot be inferred
from desktop results.

## Rules for the facilitator

**Do not explain the game before starting.** Say only: *"This is a short game. Play it however you
like. Think out loud if you can. I can't answer questions while you play."*

Do not touch the keyboard. Do not point at the screen. Do not rescue a struggling player — a
player who cannot work out how to shoot **is the finding**.

If a player asks a direct question, say *"whatever you think"* and note the question verbatim. The
questions players ask are the highest-value data in the session.

## Session shape (about 20 minutes)

1. **Cold open (no prompt).** Hand over the game already on the menu. Start the clock. Say nothing.
2. **Three runs minimum**, or until the player stops of their own accord. Do not ask them to
   continue — whether they continue is the measurement.
3. **Debrief** (5 minutes, questions below).

Between participants: clear site data so onboarding hints and the run history reset. In the browser
console, `localStorage.clear()` is sufficient.

## Observation sheet

Record for each participant. Note the **time** of each first occurrence, not just whether it
happened.

### Comprehension

| Observation | Record |
| --- | --- |
| Time to first deliberate movement | seconds |
| Time to first shot | seconds |
| Did they read the on-screen hints, or ignore them? | yes / no / partly |
| Did they discover the dash unprompted? | yes / no / prompted by hint |
| Did they discover Q / E / R abilities unprompted? | which ones, when |
| Did they understand XP orbs were collectable? | yes / no / unclear |
| Did they notice the XP bar at the bottom? | yes / no |

### The reward loop

| Observation | Record |
| --- | --- |
| Did they reach a level-up at all? | yes / no — **if no, the run failed the core test** |
| Time spent reading the level-up cards | seconds — target is under 2 |
| Did they understand what the upgrade did? | ask afterwards, do not prompt during |
| Did they use the keyboard or the mouse to choose? | which |
| Did they notice the level pips? | ask in debrief |

### Combat feel

| Observation | Record |
| --- | --- |
| Could they tell a critical hit from a normal one? | yes / no |
| Could they tell an elite from a normal enemy? | yes / no |
| Did they react to enemy attack telegraphs? | dodged / ignored / did not see |
| Did they understand why they died? | ask immediately: *"what killed you?"* |
| Any moment they visibly enjoyed? | quote it |
| Any moment of visible frustration? | quote it |

### The boss

Reaching the boss takes five minutes of survival, so most first sessions will not get there. If a
session does:

| Observation | Record |
| --- | --- |
| Did the entrance register as significant? | yes / no |
| Did they notice the phase change? | yes / no |
| Was the boss health bar readable during the fight? | yes / no |

### The KPI

| Observation | Record |
| --- | --- |
| **Did they press restart without being asked?** | yes / no — **primary behavioural KPI** |
| How long between death screen and restart? | seconds |
| How many runs did they play before stopping? | count |
| Who ended the session, player or facilitator? | which |

## Debrief questions

Ask in this order. The first question must come before any leading language.

1. **"Would you play another run right now?"** — the primary qualitative KPI. Record the answer
   verbatim, including hesitation.
2. "In one sentence, what is this game about?"
3. "What were you trying to do?"
4. "What killed you?"
5. "What did the upgrades you picked do?"
6. "Was there anything you didn't understand?"
7. "Was there anything that felt good?" — do not supply examples.
8. "Was there anything that felt bad or unfair?"
9. Only now, if they never used them: "Did you notice the Q, E and R abilities?"

## Recorded data

The build writes per-run playtest data to local storage only. Nothing is sent anywhere, no
identifier is created, and no personal data is recorded. Read it from the browser console on the
machine the session ran on:

```js
// Full history (last 25 runs)
JSON.parse(localStorage.getItem('leek-ops-playtest-v1'))
```

Each record holds run duration, level reached, kills, damage dealt and taken, shots fired, ability
uses, upgrade picks in order, weapon, boss reached, boss defeated, outcome, and whether the player
restarted.

`summariseRuns()` in `src/game/systems/RunTelemetry.ts` computes the headline figures: run count,
restart rate, median duration, and the fraction of runs that reached a level-up.

Copy the raw JSON out per participant before clearing site data for the next one.

## Thresholds

These are the bars the alpha is being held to. They are targets to test against, not predictions.

| Measure | Target |
| --- | --- |
| Restart rate (unprompted) | **≥ 60%** of deaths |
| "Would you play another run?" | **≥ 6 of 10** unhesitating yes |
| Reached a level-up in their first run | **≥ 70%** |
| Time to first shot | **< 15 s** |
| Understood what killed them | **≥ 80%** |
| Told a critical from a normal hit | **≥ 60%** |
| Time reading level-up cards | **< 2 s** |

## Known risk to watch for

Scripted runs used during development died at **8–17 seconds while still at level 1**. If human
playtests reproduce that, players never see the level-up at all and the reward loop never closes —
which would make "reached a level-up in their first run" the finding that matters most in this
round. Record it precisely; it is a balance decision for Phase E, not a UI one.

## Reporting

Per participant, one page: the observation sheet, verbatim answers to questions 1–4, and the raw
telemetry JSON.

Across the round, report the KPI table above, then the three most-repeated points of confusion and
the three most-repeated moments of enjoyment, each with a supporting quote. Rank fixes by how many
participants hit them, not by how easy they are.
