# YRFI — Design Spec
**Date:** 2026-04-09
**Status:** Approved

## Overview

A standalone MLB betting tool that calculates the probability of a run being scored in the first inning (YRFI — Yes Run First Inning) for every game on today's slate. For each game it displays the model's YRFI probability and the minimum American odds a user would need to find at their sportsbook to have a positive expected value (+EV) bet. No sportsbook integration — users compare the threshold against their own book and decide.

**Repo:** `yrfi` (GitHub)
**Deployment:** Vercel (distinct from bvp-betting)
**Stack:** Next.js 16, React 19, App Router only, Tailwind v4 (`@import "tailwindcss"`), TypeScript, Vercel KV

---

## Data Sources

| Source | What it provides | Auth |
|---|---|---|
| MLB Stats API (`statsapi.mlb.com/api/v1`) | Schedule, starting pitchers, pitcher season stats (FIP components: HR, BB, HBP, K, IP), team season OBP, boxscore linescore | None |
| Baseball Savant (`baseballsavant.mlb.com`) | Pitcher barrel rate, hard-hit rate — season-to-date CSV, fetched once daily | None |
| Open-Meteo (`api.open-meteo.com`) | Temperature, wind speed, wind direction per venue (supports forecast data for tomorrow) | None |

All three sources are free with no API key required.

**Note on team OBP:** First-inning specific OBP splits are not reliably available via the public MLB Stats API. We use season-long team batting OBP as a proxy for first-inning offensive quality. This is fetched from `/api/v1/teams/{teamId}/stats?stats=season&group=hitting&season={year}` and is a reasonable approximation since lineup OBP quality is consistent throughout a game.

---

## Architecture

```
app/
  page.tsx                  # Server component — renders shell
  layout.tsx                # Root layout, metadata, OG tags
  api/
    games/route.ts          # Main endpoint: all games for a date with YRFI model output
lib/
  types.ts                  # GameResult, GamesResponse, PitcherStats, SavantStats, WeatherData
  mlb-api.ts                # Schedule fetch, pitcher season stats, team OBP, boxscore linescore
  savant-api.ts             # Baseball Savant CSV fetch, parse, KV cache (12hr TTL)
  weather-api.ts            # Open-Meteo fetch; hardcoded stadium constants (lat, long, outfieldFacingDegrees)
  park-factors.ts           # Hardcoded runs park factor table for all 30 stadiums (1.00 scale; source: FanGraphs; updated once/season)
  poisson.ts                # λ calculation, P(YRFI), break-even American odds
  game-status.ts            # getGameStatus(), computeFirstInningResult() → 'run' | 'no_run' | 'pending'
  cache.ts                  # createCache<T>(ttlMs) — in-memory TTL cache
  kv.ts                     # Vercel KV wrapper with in-memory fallback; kvGet/kvSet(key, value, ttlSeconds?)
  site.ts                   # getSiteUrl(), SITE_NAME = 'YRFI'
  components/
    ClientShell.tsx         # Root client component; owns state; two timers: re-fetch every 5 min (API call), re-render every 60s (UI clock update only — no API call)
    GameTable.tsx           # Ranked table (desktop) + stacked card list (mobile)
    GameRow.tsx             # Single table row: teams, pitchers, YRFI %, min odds, weather, time, result badge
    DatePicker.tsx          # Today/tomorrow navigation using Pacific slate date (America/Los_Angeles); compact pills on mobile
    StatusBar.tsx           # Last updated timestamp, game count, manual refresh button; stays inline on mobile
    ConfigPanel.tsx         # Preferences control; dropdown on desktop, centered modal on mobile
    LoadingSkeleton.tsx     # Loading state with elapsed timer
```

---

## Data Flow

1. `ClientShell` fetches `/api/games?date=YYYY-MM-DD` on mount and date change.
2. Route checks `games-response:{date}` KV cache (5-min TTL) — returns immediately if found.
3. On cache miss:
   a. Fetch schedule (`/schedule?sportId=1&date=DATE&hydrate=probablePitcher,lineups`, always `cache: 'no-store'`) → extract games, starting pitcher IDs, game times, venue IDs. Filter out PPD/cancelled games via `g.status.detailedState`.
   b. Load Baseball Savant barrel rate data from KV (`savant-pitchers:{year}`); fetch from Savant and populate KV if missing (12hr TTL).
   c. Fetch Open-Meteo weather for each venue using hardcoded stadium coordinates. Supports both today and tomorrow (forecast endpoint).
   d. Fetch pitcher season stats from MLB Stats API in batches (`/people/{id}/stats?stats=season&group=pitching&season={year}`).
   e. Fetch team season OBP from MLB Stats API (`/teams/{teamId}/stats?stats=season&group=hitting&season={year}`).
   f. Run Poisson model for each game → λ per half-inning → P(YRFI) → break-even odds.
   g. Attach first-inning result (`computeFirstInningResult()`) from boxscore linescore for in-progress/settled games.
4. Sort games by YRFI probability descending.
5. Write compiled response to KV (`games-response:{date}`, 5-min TTL).
6. Client groups rows by `gameStatus`: Upcoming → In Progress → Settled.
7. UI is responsive by design: mobile uses stacked game cards, compact matched pill controls for date/actions, a centered preferences modal, a visible Methodology label, and card-based methodology factors, while desktop preserves the fixed-width table layout.
8. `ClientShell` runs two independent timers:
   - **Re-fetch timer (5 min):** silently calls `/api/games` and updates state.
   - **Re-render timer (60s):** triggers a React state update to refresh elapsed-time displays — no API call.
9. **Staleness acknowledgement:** The 5-min KV cache means in-progress first-inning results may be up to ~10 min stale in worst case (KV cache remaining + next poll cycle). Acceptable for v1 since primary use is pre-game.

---

## The Poisson Model

### λ (Expected First-Inning Runs) Per Half-Inning

```
Base λ = 0.36  (calibrated to an observed MLB YRFI baseline around 51.4%)

Adjustments (stabilized and damped before being combined):

  FIP factor:
    = (shrunk_pitcher_FIP / league_avg_FIP)^0.55
    Higher pitcher FIP (worse) → factor > 1 → λ increases ✓
    FIP is shrunk toward league average using innings pitched before this factor is applied

  K% factor (dampened, since K% is partially captured by FIP):
    = clamp(1 + 0.3 × (league_avg_K% − shrunk_pitcher_K%) / league_avg_K%, 0.85, 1.15)
    Higher K% (better) → factor < 1 → λ decreases ✓
    K% is shrunk toward league average using batters faced before this factor is applied

  Barrel factor:
    = (shrunk_pitcher_barrel_rate% / league_avg_barrel_rate%)^0.35
    Higher barrel rate allowed (worse) → factor > 1 → λ increases ✓
    Barrel rate is shrunk toward league average using innings pitched so small samples do not overreact

  OBP factor:
    = (shrunk_team_season_OBP / league_avg_OBP)^0.70
    Higher team OBP (better offense) → factor > 1 → λ increases ✓
    Team OBP is shrunk toward league average using team plate appearances

  Park factor:
    = stadium_runs_park_factor^0.50
    Source: FanGraphs park factors, 1.00-scale (e.g. Coors Field ≈ 1.30, Petco Park ≈ 0.88)
    Applied equally to both half-innings (both teams play in the same park)

  Temp factor:
    < 55°F  → 0.92
    55–80°F → 1.00
    > 80°F  → 1.06

  Wind factor:
    Requires per-stadium outfieldFacingDegrees (compass bearing the outfield faces, e.g. Fenway ≈ 95°)
    Wind is reported as the direction it comes FROM (Open-Meteo `wind_direction_10m`)
    "Blowing out" = wind FROM behind home plate (opposite of outfield bearing, ±45°)
    "Blowing in"  = wind FROM the outfield (same as outfield bearing, ±45°)

    if wind_speed ≥ 10 mph:
      delta = abs(wind_from_direction − outfield_facing_degrees) mod 360
      if delta > 180: delta = 360 − delta        # normalize to 0–180
      if delta ≤ 45:   wind_factor = 0.93        # blowing in
      elif delta ≥ 135: wind_factor = 1.08       # blowing out
      else:             wind_factor = 1.00        # crosswind
    else:
      wind_factor = 1.00

  Roof handling:
    Fixed-roof and retractable-roof parks are treated as weather-neutral (temp = 1.00, wind = 1.00)
    because roof state is not available reliably enough pregame to price weather edge honestly

top3_factor = clamp(shrunk_top3_obp / shrunk_team_obp, 0.90, 1.12)^0.45

raw_adjustment = FIP_factor × K%_factor × barrel_factor × OBP_factor × top3_factor × park_factor × (temp_factor × wind_factor)^0.50
bounded_adjustment = clamp(raw_adjustment, 0.55, 1.55)
λ = base × bounded_adjustment

stabilization_multiplier(date) = 1.75 - 0.75 × progress_to_july_1
effective_stabilization_sample = base_stabilization_sample × stabilization_multiplier(date)
```

League averages (constants in `poisson.ts`, updated each season):
```ts
const LEAGUE_AVG_FIP = 3.80
const LEAGUE_AVG_K_PCT = 0.23
const LEAGUE_AVG_BARREL_PCT = 8.0   // expressed as percentage (0–100 scale)
const LEAGUE_AVG_OBP = 0.310
const BASE_LAMBDA = 0.36
const FIP_CONSTANT = 3.10           // ERA-scaling constant used in FIP formula
```

### From λ to YRFI Probability

```
P(home team scores 0 in 1st) = e^(−λ_home)    // away pitcher faces home lineup
P(away team scores 0 in 1st) = e^(−λ_away)    // home pitcher faces away lineup
P(YRFI) = 1 − P(home scores 0) × P(away scores 0)
```

The two half-innings are treated as independent (standard Poisson assumption, appropriate here).

At league-average inputs both λ values are 0.36, so:

```
P(YRFI) = 1 − e^(−0.36 − 0.36) = 1 − e^(−0.72) ≈ 51.3%
```

### From YRFI Probability to Break-Even American Odds

```ts
// Use Math.ceil to give the user a conservative (safer) threshold
function breakEvenOdds(p: number): number {
  if (p >= 0.5) return -Math.ceil((100 * p) / (1 - p))   // e.g. p=0.60 → -150
  return +Math.ceil((100 * (1 - p)) / p)                  // e.g. p=0.40 → +150
  // At p=0.5 exactly: negative branch returns -100, which is correct (even money)
}
```

Displayed as `"-150 or better"` (less juice) or `"+100 or better"` (higher plus money). At p=0.5 exactly, display as `"+100 or better"` (even money) by converting -100 → +100 in the display layer.

---

## Key Types (`lib/types.ts`)

```ts
interface SavantStats {
  playerId: number           // MLBAM player ID (matches MLB Stats API)
  barrelRate: number         // barrel_batted_rate from CSV (0–100 scale)
  hardHitRate: number        // hard_hit_percent from CSV (0–100 scale) — reserved for v2 model enhancement; not used in v1 Poisson formula
  inningsPitched: number     // p_formatted_ip parsed to numeric innings; used only for the 50 IP qualification check
}

interface PitcherStats {
  playerId: number
  name: string
  fip: number                // calculated: (13×HR + 3×(BB+HBP) − 2×K) / IP + 3.10
  kPct: number               // strikeouts / batters faced (0–1 scale)
  barrelRate: number         // from Savant; league avg fallback if missing
  hardHitRate: number        // from Savant; league avg fallback if missing
  confirmed: boolean         // false if TBD — uses league avg stats
  estimated: boolean         // true if pitcher identity or required stat feed was missing and league-average inputs were used
}

interface WeatherData {
  tempF: number
  windSpeedMph: number
  windFromDegrees: number    // direction wind is coming FROM
  failure: boolean           // true if Open-Meteo fetch failed; factors default to 1.0
  controlled: boolean        // true if weather is neutralized because the park is roofed/retractable
}

interface GameResult {
  gamePk: number
  gameTime: string           // ISO string
  gameStatus: 'upcoming' | 'inProgress' | 'settled'
  venue: string
  homePitcher: PitcherStats
  awayPitcher: PitcherStats
  homeTeam: string
  awayTeam: string
  homeOBP: number            // season team OBP
  awayOBP: number
  lambda: { home: number; away: number }
  yrfiProbability: number    // 0–1
  breakEvenOdds: number      // American odds integer (positive or negative)
  weather: WeatherData
  firstInningResult: 'run' | 'no_run' | 'pending'
}

interface GamesResponse {
  date: string               // YYYY-MM-DD
  games: GameResult[]
  generatedAt: string        // ISO timestamp
}

// API error response shape — returned as JSON body alongside the HTTP error status code
// `error` is a human-readable message; `status` mirrors the HTTP status (e.g. 500)
interface GamesErrorResponse {
  error: string
  status: number
}
```

---

## `computeFirstInningResult()`

```ts
// Returns 'run' if either team scored in inning 1, 'no_run' if both half-innings
// completed scoreless, 'pending' if inning 1 is not yet complete.
function computeFirstInningResult(
  linescore: MlbLinescore,
  gameStatus: 'upcoming' | 'inProgress' | 'settled'
): 'run' | 'no_run' | 'pending'
```

**Logic:**
- Read `linescore.innings[0]` (inning 1 data). If absent → `'pending'`.
- Away half-inning complete when `innings[0].away.runs` is defined (away bats first).
- Home half-inning complete when `innings[0].home.runs` is defined.
- If either `away.runs > 0` or `home.runs > 0` → `'run'`.
- If both are defined and both are 0 → `'no_run'`.
- If away is complete and home is not yet defined (top of 1st done, bottom not started) → `'pending'`.
- For `settled` games, both values will always be defined.
- "Hit" language is intentionally avoided — this function tracks **runs**, not hits.

---

## Baseball Savant Integration (`lib/savant-api.ts`)

**CSV endpoint:**
```
https://baseballsavant.mlb.com/leaderboard/statcast?type=pitcher&year={year}&position=SP,RP&team=&min=1&csv=true
```

`min=1` fetches all pitchers; qualification filter (50 IP) applied client-side after parsing.

**Key CSV columns:**
| CSV column | Maps to |
|---|---|
| `player_id` | `SavantStats.playerId` (MLBAM ID — same as MLB Stats API) |
| `barrel_batted_rate` | `SavantStats.barrelRate` (percentage, 0–100) |
| `hard_hit_percent` | `SavantStats.hardHitRate` (percentage, 0–100) |
| `p_formatted_ip` | Parsed to numeric innings for the 50 IP threshold check |

**Fallback:** If a pitcher's IP < 50 or they are absent from the CSV, `barrelRate` and `hardHitRate` default to league average (8.0 and 38.0 respectively).

**KV key:** `savant-pitchers:{year}` — stored as `Record<string, SavantStats>` keyed by `playerId.toString()`.

---

## Stadium Constants (`lib/weather-api.ts`)

Each stadium entry:
```ts
interface StadiumConstants {
  venueId: number
  name: string
  lat: number
  lon: number
  outfieldFacingDegrees: number  // compass bearing the outfield faces (0–359)
}
```

All 30 MLB stadiums hardcoded. `outfieldFacingDegrees` used to compute wind in/out factor. Example entries:
- Fenway Park: `{ venueId: 3, lat: 42.3467, lon: -71.0972, outfieldFacingDegrees: 95 }`
- Coors Field: `{ venueId: 19, lat: 39.7559, lon: -104.9942, outfieldFacingDegrees: 347 }`

---

## Park Factors (`lib/park-factors.ts`)

1.00-scale runs park factors. Source: FanGraphs park factors (updated manually each season, typically April after ~2 weeks of games or using prior year's values to start).

Neutral = 1.00. Example:
```ts
const PARK_FACTORS: Record<number, number> = {
  19: 1.30,  // Coors Field
  22: 0.88,  // Petco Park
  // ... all 30 venues
}
```

Keyed by MLB Stats API `venueId`.

---

## Edge Cases

**Missing starting pitcher:** Row displays with `confirmed: false` on pitcher. Model runs with league-average FIP (3.80), K% (23%), barrel rate (8%). YRFI % and break-even odds are prefixed with `~` to indicate estimate. Pitcher name shows "TBD".

**Weather fetch failure:** `WeatherData.failure = true` → temp and wind factors default to 1.0. Weather column shows `—`. Does not block the response.

**Game in progress, top of 1st only:** Away half-inning complete (`innings[0].away.runs` defined), home not yet started (`innings[0].home` absent) → `computeFirstInningResult()` returns `'pending'` unless away scored (in which case → `'run'` immediately).

**PPD/cancelled games:** Filtered out in schedule fetch via `g.status.detailedState` before any model work.

**Tomorrow's games:** Open-Meteo supports multi-day forecast — tomorrow's weather is available via the same endpoint with `forecast_days=2`. Baseball Savant uses today's season stats (same KV entry, intentional). MLB schedule works for any future date.

**Missing venueId in park factors:** Default park factor = 1.00 (neutral).

---

## KV Schema

| Key | Value | TTL | Purpose |
|---|---|---|---|
| `games-response:{date}` | `GamesResponse` | 5 min | Full compiled model output for the slate |
| `savant-pitchers:{year}` | `Record<string, SavantStats>` | 12 hr | Baseball Savant barrel rate + hard-hit rate by pitcher |

---

## UI Design

**Identity:** Distinct from bvp-betting. Light/white base, bold green accent (`#16a34a`), slate for secondary text. Clean, data-forward.

**OG metadata:**
- Title: `YRFI — MLB YRFI Betting Model`
- Description: `Find the minimum odds you need to bet YRFI with a statistical edge. Model-driven, updated daily.`

**Main table columns (desktop):**

| Away @ Home | Away SP | Home SP | YRFI % | Bet at | Weather | Time |
|---|---|---|---|---|---|---|
| NYY @ BOS | Cole | Sale | 38% | +163 or better | 72°F calm | 7:10p |
| COL @ ARI | Gomber | Pfaadt | 67% | -203 or better | 81°F → calm | 8:40p |

- **YRFI %** — color coded: green ≥55%, yellow 45–54%, red <45%. Prefixed `~` if pitcher is TBD.
- **Bet at** — break-even American odds. Prefixed `~` if pitcher is TBD.
- **Weather** — temperature + wind icon (calm / arrow indicating direction). `—` if fetch failed.
- **Result badge** — shown on In Progress / Settled rows: `RUN ✓` (green) or `NO` (slate).
- **Default sort** — YRFI % descending.
- **Mobile** — card layout (`sm:hidden` / `hidden sm:block` pattern).
- **Game groups** — Upcoming / In Progress / Settled.

**Client error state:** If `/api/games` returns an error response, `ClientShell` displays an inline error message with a retry button. No crash.

**Date range:** Today and tomorrow. `DatePicker` uses Pacific calendar day (`America/Los_Angeles`) as slate date anchor.

---

## Commands

```bash
npm run dev       # localhost:3000
npm run build     # production build
npm run lint      # ESLint
npm test          # Jest (lib/)
npx vercel --prod # deploy
```

---

## Out of Scope (v1)

- Top Plays / locked slate mechanic
- Discord notifications
- Admin lineup exclusions
- Sportsbook odds integration (user compares manually)
- Parlay suggestions
- First-inning specific OBP splits (season OBP used as proxy)
