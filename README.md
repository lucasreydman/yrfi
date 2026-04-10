# YRFI — MLB First Inning Betting Edge

A standalone MLB betting tool that calculates the probability of a run being scored in the first inning (**YRFI** — Yes Run First Inning) for every game on today's slate.

For each game it shows:
- The model's **YRFI probability** (%)
- The **minimum American odds** needed at your sportsbook for a +EV bet

No sportsbook integration — you compare the threshold against your own book and decide.

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
| MLB Stats API (`statsapi.mlb.com/api/v1`) | Schedule, starting pitchers, pitcher season stats (FIP components), team OBP, boxscore linescore | None |
| Baseball Savant (`baseballsavant.mlb.com`) | Pitcher barrel rate, hard-hit rate — season CSV, cached 12hr | None |
| Open-Meteo (`api.open-meteo.com`) | Temperature, wind speed, wind direction per venue (supports tomorrow's forecast) | None |

All sources are free with no API key required.

---

## How the Model Works

The model uses a **Poisson distribution** to estimate expected first-inning runs (λ) per half-inning.

```
λ = 0.50 × FIP_factor × K%_factor × barrel_factor × OBP_factor × park_factor × temp_factor × wind_factor
```

**P(YRFI)** = 1 − P(home scores 0) × P(away scores 0) = 1 − e^(−λ_home) × e^(−λ_away)

Break-even American odds are derived from the probability:
- p ≥ 0.5 → negative odds (e.g. `-150 or better`)
- p < 0.5 → positive odds (e.g. `+163 or better`)

See [docs/superpowers/specs/2026-04-09-yrfi-design.md](docs/superpowers/specs/2026-04-09-yrfi-design.md) for the full model spec.

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
npx vercel --prod # Deploy to production
```

---

## UI Behavior

- **Date range:** Today and tomorrow (Pacific calendar day as anchor)
- **Auto-refresh:** API re-fetched every 5 minutes; UI clock updates every 60s (no extra API call)
- **Game groups:** Upcoming → In Progress → Settled
- **YRFI % colors:** green ≥ 55%, yellow 45–54%, red < 45%
- **TBD pitchers:** Model runs with league-average stats; values prefixed with `~`
- **Weather failure:** Factors default to 1.0; weather column shows `—`
- **Preferences:** Temperature unit, wind unit, odds format, timezone — persisted in localStorage

---

## Out of Scope (v1)

- Sportsbook odds integration
- Parlay suggestions
- Discord notifications
- First-inning specific OBP splits (season OBP used as proxy)
- Admin lineup exclusions
