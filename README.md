# WoW Leveling Calculator

Static HTML/CSS/JS, RU/EN, Vanilla/Forever. No build step. Publish the files and `assets/` folder together through GitHub Pages. Chart.js loads from a CDN; numeric calculations still work if it cannot load.

Author: [Kivrus](https://www.youtube.com/@Kivrus). Logos supplied by the owner.

## Base and buffs

The original XP table (4,084,700 XP) and reference curve (8,990 minutes) are unchanged. Estimates start at the beginning of the current level. Positive `/played` adjusts time by `0.85 + 0.15 × actual / reference`; level 1 or blank/zero uses 1. This is a selected reference, not a measured average.

Rested is always enabled in the UI, using the existing approximation `0.4 × (24 - dailyHours) / 8 × 0.05`. It assumes rest-area logout and does not simulate the reserve. Forever Sleeping Bag adds 3% total XP from level 14. Food adds 5% kill XP, modeled as 2% total XP at a 40% kill share. Bonuses are additive assumptions. `/played` still compares against the unboosted reference, so past buffs and AFK cannot be separated. No class or profession coefficients are invented.

## Full-route dungeon scenario (owner's revised estimates, 2026-10-06)

This replaces the previous Deadmines-only comparison. All 35 supplied dungeon entries are retained in `dungeons.js`, including nine new ones, faction rewards, min/max/typical level, quest XP, Classic counterparts when available, estimated extra-XP ranges, and confidence. Early entries are `reported` or `partial`, later entries are `estimated`; these labels do not claim independent verification.

For old dungeons, use **additional** quest XP over Classic. For new dungeons, use the estimated new quest package. Range midpoints are used. Known quest/Classic pairs take precedence over placeholder extra-XP ranges, so changing the reward data changes the forecast. Approximate early Classic counterparts are inferred from the supplied package/delta pairs and stored separately.

SM's four wings share ONE quest budget, Dire Maul's three wings share ONE, and the two Stratholme entrances share ONE. Package shares prevent duplicate credit. If replacing a group budget with actual per-wing rewards, change the package shares accordingly.

Each dungeon is assigned to the level block containing its typical level. This is a smoothed route model rather than an individual event simulator.

| Block | Fraction of theoretical quest packages covered by a first-run route | Alliance raw route XP | Horde raw route XP |
| --- | ---: | ---: | ---: |
| 13–20 | 100% | 56,250 | 44,650 |
| 20–30 | 100% | 51,100 | 55,400 |
| 30–40 | 100% | 128,100 | 133,600 |
| 40–50 | 90% | 193,500 | 193,500 |
| 50–60 | 50% | 402,000 | 407,000 |

The 90%/50% route coverage values reconcile the listed theoretical late packages with the owner's ~160–230k and ~300–500k block budgets: one first visit cannot finish every late quest chain. These are explicit calibration assumptions, separate from time efficiency. They are not game mechanics or measured completion rates.

```
routeExtraXP = sum(dungeon extra quest XP × package share) × route coverage
effectiveXP = routeExtraXP × 0.40 × attendance
attendance = 0 for Off, 0.65 for Typical, 1 for All first runs
blockReduction = min(0.30, effectiveXP / actual XP required for the block)
levelTime = referenceLevelTime × playerTimeMultiplier / xpBoost × (1 - blockReduction)
```

The 40% factor already allows for the event, group formation, travel, foregone outdoor XP, low mob XP (~×0.25 beta assumption), and overlap with Vanilla dungeon behavior. **Do not deduct mob loss or run time again.** This replaces the old per-event model; the two approaches must not be stacked.

Level 1–13 gets no dungeon reduction. The same reduction is spread through each affected block; only future levels contribute to remaining time. Completed portions are not re-awarded, including when starting partway through a block. Remaining XP shown to the player is unchanged. The graph and the results use the same adjusted per-level durations. The 30% cap is a forecast guard, not a game rule; current estimates do not reach it.

Typical represents 65% of the full-route effect, not repeat farming. All first runs still assumes reasonable first-visit quest coverage, not every theoretical quest chain. The effect is an explicitly chosen scenario, particularly uncertain after level 30. Replacing estimates with observations refines that scenario; it does not turn it into an exact simulator.

## Validation

Run `node --test script.test.js` (14 checks). Includes preserved baseline, buff thresholds, 35 unique dungeons/nine new, group-package deduplication, both factions/all five blocks, coefficient application, automatic reward updates, partial-block handling, positive times, and agreement between results and graph.

Example: Alliance, level 1, no `/played`, 2 hours/day, automatic rested and both Forever buffs:

- Off: **135h 48m**
- Typical: **128h 41m** (about **7h 08m** saved)
- All first runs: **124h 50m** (about **10h 58m** saved)

Values are independently rounded to minutes.
