export default function MethodologyView() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-700">

      {/* Intro */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-2">How the model works</h2>
        <p className="text-slate-500 leading-relaxed">
          YRFI uses a Poisson probability model to estimate the likelihood that at least one run
          scores in the first inning of each game. Each half-inning is modeled independently,
          then combined. The output is the minimum American odds at which a YRFI bet has positive expected value.
        </p>
      </div>

      {/* Step 1 */}
      <Section title="Step 1 — Estimate λ (expected runs) for each half-inning">
        <p className="mb-3 leading-relaxed">
          λ represents the expected number of runs scored by one team in the first inning.
          It starts at a baseline of <Mono>0.50</Mono> (the historical MLB average for a half-inning)
          and is scaled by six factors:
        </p>
        <FormulaBlock>
          λ = 0.50 × FIP factor × K% factor × Barrel factor × OBP factor × Park factor × Weather factors
        </FormulaBlock>

        <FactorTable factors={[
          {
            name: 'FIP factor',
            formula: 'pitcher FIP ÷ 3.80',
            description: 'Scales λ up for bad pitchers (high FIP) and down for elite ones. FIP weights only the outcomes a pitcher controls: home runs, walks, hit-by-pitches, and strikeouts.',
            source: 'MLB Stats API',
          },
          {
            name: 'K% factor',
            formula: 'clamp(1 + 0.3 × (0.23 − K%) ÷ 0.23,  0.85 → 1.15)',
            description: 'A high strikeout rate means fewer balls in play and fewer baserunners. Clamped so a single extreme K% can\'t swing λ by more than ±15%.',
            source: 'MLB Stats API',
          },
          {
            name: 'Barrel factor',
            formula: 'pitcher barrel rate ÷ 8.0%',
            description: 'Barrel rate (hard, optimal contact that almost always produces extra bases) is the best single-number proxy for how hittable a pitcher is beyond what FIP captures.',
            source: 'Baseball Savant',
          },
          {
            name: 'OBP factor',
            formula: 'team OBP ÷ 0.310',
            description: 'Teams that get on base more often score more runs. This adjusts λ for the batting lineup facing the pitcher.',
            source: 'MLB Stats API',
          },
          {
            name: 'Park factor',
            formula: 'hardcoded per venue (FanGraphs 1.00 scale)',
            description: 'Some parks inflate run-scoring (Coors Field: 1.28) while others suppress it (Petco Park: 0.88). Applied once, shared by both half-innings.',
            source: 'FanGraphs',
          },
          {
            name: 'Temp factor',
            formula: '< 55°F → 0.92 · > 80°F → 1.06 · else 1.00',
            description: 'Cold air is denser; baseballs carry less well. Hot air slightly increases carry. Dome/retractable-roof parks default to 1.00.',
            source: 'Open-Meteo',
          },
          {
            name: 'Wind factor',
            formula: '≥ 10 mph blowing in → 0.93 · blowing out → 1.08 · else 1.00',
            description: 'Wind direction is resolved relative to each park\'s outfield orientation. Blowing in suppresses fly balls; blowing out boosts them.',
            source: 'Open-Meteo',
          },
        ]} />

        <p className="mt-4 text-slate-500 text-xs leading-relaxed">
          Each team's λ uses that team's OBP and the <em>opposing</em> pitcher's stats —
          because the home team bats against the away starter, and vice versa.
          League-average values are used for any pitcher listed as TBD.
        </p>
      </Section>

      {/* Step 2 */}
      <Section title="Step 2 — Compute P(YRFI) from both λ values">
        <p className="mb-3 leading-relaxed">
          Under a Poisson model, the probability of scoring <em>zero</em> runs given expected rate λ is simply{' '}
          <Mono>e^(−λ)</Mono>. YRFI hits when <em>either</em> team scores, so:
        </p>
        <FormulaBlock>
          P(YRFI) = 1 − P(home scores 0) × P(away scores 0){'\n'}
          P(YRFI) = 1 − e^(−λ_home) × e^(−λ_away){'\n'}
          P(YRFI) = 1 − e^(−λ_home − λ_away)
        </FormulaBlock>
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          This assumes independence between the two half-innings, which is a reasonable approximation
          since different batters face different pitchers. At league-average inputs both λ values equal
          0.50, giving P(YRFI) = 1 − e^(−1) ≈ <strong>63.2%</strong>.
        </p>
      </Section>

      {/* Step 3 */}
      <Section title="Step 3 — Convert probability to break-even American odds">
        <p className="mb-3 leading-relaxed">
          The "Bet at" column shows the worst odds at which a YRFI bet still has positive expected
          value. If the sportsbook offers better odds than this, the bet is +EV.
        </p>
        <FormulaBlock>
          p ≥ 0.50  →  break-even = −⌈100p ÷ (1 − p)⌉   (favorite){'\n'}
          p &lt; 0.50  →  break-even = +⌈100(1 − p) ÷ p⌉  (underdog)
        </FormulaBlock>
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          Ceiling (⌈⌉) is used instead of rounding so the threshold is always conservative —
          you need odds <em>at least</em> this good, not just approximately this good.
          A <Mono>~</Mono> prefix means one or both pitchers were TBD at the time of calculation;
          treat those numbers as estimates.
        </p>
      </Section>

      {/* Caveats */}
      <Section title="What the model doesn't capture">
        <ul className="space-y-1.5 text-slate-500 leading-relaxed list-disc list-inside">
          <li>Lineup construction (leadoff hitter quality, platoon splits)</li>
          <li>Bullpen usage or opener strategies</li>
          <li>In-game factors like pitch count, injury, or weather changes mid-game</li>
          <li>Umpire tendencies or day/night splits</li>
          <li>Sample size noise early in the season (fewer than ~50 IP = league-average Savant stats used)</li>
        </ul>
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          This model is a starting point for identifying value, not a guaranteed edge.
          Always cross-reference with current lineup news before placing a bet.
        </p>
      </Section>

      {/* Sources */}
      <Section title="Data sources">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { name: 'MLB Stats API', url: 'https://statsapi.mlb.com', detail: 'Schedule, pitcher season stats (FIP inputs), team OBP — free, no key required' },
            { name: 'Baseball Savant', url: 'https://baseballsavant.mlb.com', detail: 'Statcast metrics: barrel rate, hard-hit % — free CSV download, no key required' },
            { name: 'FanGraphs', url: 'https://www.fangraphs.com/guts.aspx?type=pfh', detail: 'Park factors (1.00 scale) — hardcoded per season, updated annually' },
            { name: 'Open-Meteo', url: 'https://open-meteo.com', detail: 'Hourly forecast: temperature, wind speed, wind direction — free, no key required' },
          ].map(s => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
            >
              <div className="font-semibold text-green-700 mb-1">{s.name}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{s.detail}</div>
            </a>
          ))}
        </div>
      </Section>

    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-base font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">{title}</h3>
      {children}
    </div>
  )
}

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
      {children}
    </pre>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
}

function FactorTable({ factors }: {
  factors: { name: string; formula: string; description: string; source: string }[]
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider w-[130px]">Factor</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider w-[200px]">Formula</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">Rationale</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider w-[110px]">Source</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f, i) => (
            <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap align-top">{f.name}</td>
              <td className="px-4 py-3 font-mono text-slate-600 align-top">{f.formula}</td>
              <td className="px-4 py-3 text-slate-500 leading-relaxed align-top">{f.description}</td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap align-top">{f.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
