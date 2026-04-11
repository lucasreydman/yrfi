# BET-YRFI — MLB YRFI Betting Model

A standalone MLB betting tool that calculates the probability of a run being scored in the first inning (**YRFI** — Yes Run First Inning) for every game on the selected slate.

For each game it shows:
- The model's **YRFI probability** (%) to two decimal places
- The **minimum American odds** needed at your sportsbook for a +EV bet

**See also:** [BET-NRFI](https://bet-nrfi.vercel.app) — the companion tool for the other side of the same bet.

No sportsbook integration — you compare the threshold against your own book and decide.

---

## App and URL

- **App name:** `bet-yrfi`
- **Production URL:** `https://bet-yrfi.vercel.app`

---

## Stack

- **Framework:** Next.js (App Router only)
- **UI:** React 19, Tailwind v4 (`@import "tailwindcss"`)
- **Language:** TypeScript
- **Cache:** Vercel KV (in-memory fallback for local dev)
- **Deployment:** Vercel

---

## Data Sources

| Source | What it provides | Auth |
|---|---|---|
| MLB Stats API (`statsapi.mlb.com/api/v1`) | Schedule, starting pitchers, pitcher season stats (FIP components), team OBP, lineup order, boxscore linescore | None |
| Baseball Savant (`baseballsavant.mlb.com`) | Pitcher barrel rate, hard-hit rate — season CSV, cached 12hr | None |
| Open-Meteo (`api.open-meteo.com`) | Temperature, wind speed, wind direction per venue (forecast for upcoming games, archive for backtests) | None |

All sources are free with no API key required.

---

## How the Model Works

The model uses a **Poisson distribution** to estimate expected first-inning runs (λ) per half-inning.

```
λ = 0.3371 × bounded_adjustment_score
```

The neutral baseline was recalibrated from every completed MLB regular-season game in 2023-2025, the post-pitch-clock sample: `3575` YRFI outcomes in `7290` games, or `49.05%` YRFI and `50.95%` NRFI. The adjustment score is built from stabilized pitcher FIP, K%, Savant barrel rate, team OBP, confirmed top-of-order OBP, park factor, and weather. Noisy early-season inputs use a larger stabilization sample that tapers linearly from `1.75x` on March 15 to `1.00x` by July 1, correlated factors are damped, and the combined adjustment is bounded to keep the model in a realistic MLB range.

**P(YRFI)** = 1 − P(home scores 0) × P(away scores 0) = 1 − e^(−λ_home) × e^(−λ_away)

Break-even American odds are derived from the probability:
- p ≥ 0.5 → negative odds (for example `-150 or better`)
- p < 0.5 → positive odds (for example `+163 or better`)

---

## Project Structure

```
app/
  page.tsx                   # Server component shell
  layout.tsx                 # Root layout, metadata, OG tags
  api/games/route.ts         # Main endpoint — all games with YRFI model output
  context/SettingsContext.tsx # User preferences (temp unit, wind unit, odds format, timezone)
  components/
    ClientShell.tsx          # Root client component; owns state + polling timers
    GameTable.tsx            # Ranked table (desktop) + card list (mobile)
    GameRow.tsx              # Single row: teams, pitchers, YRFI %, min odds, weather, result
    DatePicker.tsx           # Today/tomorrow navigation (Pacific date anchor)
    StatusBar.tsx            # Last updated, game count, manual refresh
    LoadingSkeleton.tsx      # Loading state with elapsed timer
    ConfigPanel.tsx          # Preferences panel (temp, wind, odds format, timezone)
    MethodologyView.tsx      # Poisson model explainer tab
lib/
  types.ts                   # GameResult, GamesResponse, PitcherStats, SavantStats, WeatherData
  mlb-api.ts                 # Schedule, pitcher stats, team OBP, boxscore linescore
  savant-api.ts              # Baseball Savant CSV fetch + KV cache (12hr TTL)
  weather-api.ts             # Open-Meteo fetch; hardcoded stadium lat/lon/outfieldFacing
  park-factors.ts            # Hardcoded runs park factors for all 30 stadiums (FanGraphs)
  poisson.ts                 # λ calculation, P(YRFI), break-even American odds
  game-status.ts             # getGameStatus(), computeFirstInningResult()
  cache.ts                   # createCache<T>(ttlMs) — in-memory TTL cache
  kv.ts                      # Vercel KV wrapper with in-memory fallback
  site.ts                    # getSiteUrl(), SITE_NAME
```

---

## KV Cache Schema

| Key | Value | TTL | Purpose |
|---|---|---|---|
| `games-response:{date}` | `GamesResponse` | 5 min | Full compiled model output for the slate |
| `savant-pitchers:{year}` | `Record<string, SavantStats>` | 12 hr | Barrel rate + hard-hit rate by pitcher |

---

## Commands

```bash
npm run dev       # Start dev server at localhost:3000
npm run build     # Production build
npm run lint      # ESLint
npm test          # Jest (lib/ unit tests)
npm run backtest -- 2025-04-01 2025-04-30  # Historical calibration run
npx vercel --prod # Deploy to production
```

---

## UI Behavior

- **Date range:** Today and tomorrow (Pacific calendar day as anchor)
- **Auto-refresh:** API re-fetched every 5 minutes; UI clock updates every 60s (no extra API call)
- **Game groups:** Upcoming → In Progress → Settled
- **Responsive layout:** Mobile uses stacked game cards, condensed controls, and a card-based methodology view; desktop keeps the fixed-width ranked table layout
- **Matchup labels:** Team nicknames only in table and mobile card views (for example, Yankees, Twins, Red Sox)
- **YRFI % colors:** green–yellow–red gradient anchored to the model's realistic range (44–60%); green = well above league average, yellow = near average (~49%), red = well below average. Same gradient direction as BET-NRFI — greener always means a stronger bet signal.
- **YRFI % display:** Percentages render to two decimal places
- **Result column:** Upcoming shows `—`, in-progress first innings show `IP`, scoring first innings show `RUN`, and scoreless first innings show `NO RUN`
- **Desktop table alignment:** Temp, Wind, Time, and Result use centered fixed-width columns for uniform spacing
- **Mobile controls:** Today, Tomorrow, Preferences, and Methodology use the same compact pill treatment; the methodology tab keeps Back to games and Methodology aligned on one row with matched sizing
- **Estimate marker:** `~` prefixes YRFI when one or both probable starters are still TBD or when a named starter still relies on fallback pitcher inputs
- **Odds availability:** Break-even odds are hidden only when a probable starter is still TBD
- **Lineup-aware adjustment:** If a confirmed batting order is posted, the model compares the top three hitters against the team baseline and adjusts the YRFI number accordingly
- **Roofed/retractable parks:** Weather is neutralized and the UI shows `Roof`
- **Weather failure:** Factors default to 1.0; weather column shows `—`
- **Preferences:** Temperature unit, wind unit, odds format, timezone — persisted in localStorage
- **Footer:** Left side links to lucasreydman.xyz; right side links to BET-NRFI (highlighted in red, matching that site's accent color)
- **Methodology math:** Formula blocks use smaller mobile typography so they stay visible without horizontal scrolling

---

## Out of Scope (v1)

- Sportsbook odds integration
- Parlay suggestions
- Discord notifications
- First-inning specific OBP splits (season OBP used as proxy)
- Admin lineup exclusions
