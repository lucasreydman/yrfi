# Graph Report - C:/Users/lucas/dev/yrfi  (2026-04-10)

## Corpus Check
- Corpus is ~23,837 words - fits in a single context window. You may not need a graph.

## Summary
- 133 nodes · 170 edges · 19 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `Poisson Model (λ Calculation)` - 8 edges
2. `api/games/route.ts (Main Endpoint)` - 7 edges
3. `GameRow()` - 6 edges
4. `fetchPitcherModelStats()` - 6 edges
5. `isVercelKvAvailable()` - 4 edges
6. `computeLambda()` - 4 edges
7. `loadSavantStore()` - 4 edges
8. `getPacificDate()` - 3 edges
9. `seasonForDate()` - 3 edges
10. `GET()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `lib/poisson.ts` --implements--> `Poisson Model (λ Calculation)`  [INFERRED]
  CLAUDE.md → README.md
- `Lesson: Validate Poisson Baseline Early` --rationale_for--> `Poisson Model (λ Calculation)`  [INFERRED]
  tasks/lessons.md → README.md
- `lib/weather-api.ts` --conceptually_related_to--> `Park Factors (All 30 Stadiums)`  [INFERRED]
  CLAUDE.md → README.md
- `Lesson: MLB Lineup Hydration Reliability` --rationale_for--> `lib/mlb-api.ts`  [INFERRED]
  tasks/lessons.md → CLAUDE.md

## Hyperedges (group relationships)
- **YRFI Data Pipeline** — claude_games_route, claude_mlb_api_ts, claude_savant_api_ts, claude_weather_api_ts, claude_poisson_ts, claude_kv_ts [EXTRACTED 0.95]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (8): formatOddsDisplay(), formatPct(), formatTemp(), formatTime(), formatWind(), GameRow(), clamp(), getYrfiTextClass()

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (20): ClientShell (Root Client Component), api/games/route.ts (Main Endpoint), Vercel KV Cache, lib/kv.ts (Vercel KV Wrapper), lib/mlb-api.ts, lib/poisson.ts, lib/savant-api.ts, lib/types.ts (Shared Types) (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (0): 

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (5): GET(), getPacificDate(), seasonForDate(), fetchWeather(), getStadiumConstants()

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (11): calcFip(), calcKPct(), estimateTeamPlateAppearances(), extractTopOfOrderStats(), fetchGameLineupStats(), fetchPitcherFipAndKPct(), fetchPitcherModelStats(), fetchPitcherStatLine() (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (6): clamp(), computeLambda(), dateAdjustedStabilizationSample(), stabilizationMultiplierForDate(), tempFactor(), windFactor()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (2): getSiteUrl(), stripTrailingSlash()

### Community 7 - "Community 7"
Cohesion: 0.48
Nodes (5): fetchSavantCsv(), loadSavantStore(), parseIP(), parseSavantCsv(), savantKey()

### Community 8 - "Community 8"
Cohesion: 0.8
Nodes (4): isVercelKvAvailable(), kvDel(), kvGet(), kvSet()

### Community 9 - "Community 9"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (1): YRFI Project Context

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (1): lib/park-factors.ts

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (1): lib/game-status.ts

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (1): SettingsContext (User Preferences)

## Knowledge Gaps
- **12 isolated node(s):** `YRFI MLB Betting Model`, `YRFI Project Context`, `Break-Even American Odds Calculator`, `MLB Stats API Data Source`, `Baseball Savant Data Source` (+7 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (2 nodes): `cache.ts`, `createCache()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (1 nodes): `jest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `jest.setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `react-katex.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `YRFI Project Context`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `lib/park-factors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `lib/game-status.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `SettingsContext (User Preferences)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `Poisson Model (λ Calculation)` (e.g. with `lib/poisson.ts` and `Lesson: Validate Poisson Baseline Early`) actually correct?**
  _`Poisson Model (λ Calculation)` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `YRFI MLB Betting Model`, `YRFI Project Context`, `Break-Even American Odds Calculator` to the rest of the system?**
  _12 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._