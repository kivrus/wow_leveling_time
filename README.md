# WoW Leveling Calculator

An online calculator for estimating time to level 60 in WoW Vanilla and WoW Forever.
Uses your current level, `/played`, and daily playtime to calculate remaining gameplay hours, days to level 60, and a progress chart.

**[Open calculator](https://kivrus.github.io/wow_leveling_time/)** · **[YouTube — Kivrus](https://www.youtube.com/@Kivrus)**

## Features

- Vanilla / Forever modes and RU / EN interface.
- Pace adjustment based on `/played`, with automatic Rested XP estimation.
- Forever: Sleeping Bag from level 14, Food EXP Buff, and faction selection.
- Dungeons: Off, Typical, or All first runs with quests.
- Start date, calendar ETA for level 60, milestone dates, and dates in chart tooltips.

## Calculation

The baseline 1–60 curve totals **8,990 minutes** (149 h 50 min) and **4,084,700 XP**. Estimates start at the beginning of the selected level.

```text
Pace factor = 0.85 + 0.15 × (actual /played / baseline /played)
Time per level before Rested = baseline time × pace factor / XP multiplier × (1 − dungeon reduction)
Rested efficiency = 0.25 + 0.60 / (1 + exp(-(level − 38) / 8))
Rested bonus XP per rest interval = level XP × offline hours × 0.025 / 8 × rested efficiency
Days to 60 = remaining gameplay hours / daily playtime
```

The pace factor is 1 when `/played` is missing or zero, or the character is level 1.

- **Rested:** one daily session followed by `24 − daily playtime` hours in an inn/city. A reserve of bonus XP doubles kill rewards until depleted; quests do not consume it. The displayed 5% bar per 8 hours includes normal + bonus kill XP, so the bonus reserve grows by 2.5% of level XP and caps at 75% (150% displayed). See [CMaNGOS Classic's rest implementation](https://github.com/cmangos/mangos-classic/blob/master/src/game/Entities/Player.cpp): `ComputeRest`, `SetRestBonus`, and `GetXPRestBonus`. This is an emulator reference, not official Blizzard source code.
- **Rested simulation:** advances between session ends, reserve depletion, and level-ups. Unused XP carries over without rescaling at level-up. Initial reserve is zero at level 1; later forecasts assume one normal rest interval, since the actual reserve is unknown. Rested doubles the buff-adjusted kill rate; extra dungeon quest XP does not receive Rested. The same Vanilla rest rules are assumed for Forever.
- **Rested calibration:** a level-dependent utilization factor represents imperfect real-world rest usage, not an in-game scaling rule. It rises smoothly from roughly 25–30% at low levels toward 80% at high levels. It affects only new accumulation, including the estimated initial reserve; existing XP and the reserve cap are unchanged.
- **Buffs:** Sleeping Bag adds 3% to all XP from level 14; Food adds 5% to kill XP. Kills are assumed to provide 40% of total XP, and bonuses are additive.
- **Sleeping Bag setup:** from level 14, time with the buff is multiplied by `123 / 120` to allow 3 minutes of rest per 2 hours of active buff time. This is an averaged cost, without rounding at level or session boundaries; the first and final partial cycles are not simulated.
- **Dungeons:** extra quest rewards are distributed across level brackets 13–20 / 20–30 / 30–40 / 40–50 / 50–60. The reduction is `min(0.30, route extra XP × 0.40 × attendance / bracket XP)`. Attendance is 0 / 0.65 / 1 for the three modes. The 0.40 factor accounts for time costs and low mob XP; route quest coverage is 100% / 100% / 100% / 90% / 50% across the brackets. Displayed savings compare the route with and without dungeons, each with its own Rested consumption.

Coefficients are modeling assumptions. Dungeon data, especially above level 30, are estimates. Classes and professions are not modeled separately.

**Calendar dates:** Start date defaults to the user's local current date and only translates existing graph points into calendar milestones. Changing it does not affect leveling speed. The selected date is the first play day: each ETA adds `max(0, ceil(projected days) − 1)` calendar days, assuming daily sessions.

## Stack and setup

Static HTML, CSS, and JavaScript. Charts use Chart.js from a CDN. No build step or backend is required.

Open `index.html` in a browser. For GitHub Pages, publish the project files together with the `assets/` folder, using branch `main` and folder `/` as the publishing source.

- `index.html`, `style.css` — markup and styling.
- `ui.js` — interface, localization, and chart.
- `script.js` — time calculations.
- `dungeons.js` — dungeon data and coefficients.

Run calculation tests (requires Node.js):

```sh
node --test script.test.js
```
