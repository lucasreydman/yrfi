'use client'

import { BlockMath, InlineMath } from 'react-katex'

const lambdaMath = String.raw`\begin{aligned}
\lambda &= 0.36 \times A_{\text{bounded}} \\
A_{\text{raw}} &= F_{\text{FIP}} \times F_{K} \times F_{\text{barrel}} \times F_{\text{OBP}} \times F_{\text{top3}} \times F_{\text{park}} \times F_{\text{weather}} \\
A_{\text{bounded}} &= \operatorname{clamp}(A_{\text{raw}}, 0.55, 1.55)
\end{aligned}`

const yrfiMath = String.raw`\begin{aligned}
P(\mathrm{YRFI}) &= 1 - P(\text{home scores }0)\,P(\text{away scores }0) \\
&= 1 - e^{-\lambda_{\text{home}}} e^{-\lambda_{\text{away}}} \\
&= 1 - e^{-(\lambda_{\text{home}} + \lambda_{\text{away}})}
\end{aligned}`

const oddsMath = String.raw`\mathrm{break\mbox{-}even\ odds}=
\begin{cases}
-\left\lceil \dfrac{100p}{1-p} \right\rceil & p \ge 0.50 \\
+\left\lceil \dfrac{100(1-p)}{p} \right\rceil & p < 0.50
\end{cases}`

const stabilizationMath = String.raw`\begin{aligned}
s_{\text{effective}} &= s_{0}\,m(d) \\
m(d) &= 1.75 - 0.75\,p(d) \\
p(d) &= \operatorname{clamp}\!\left(\dfrac{d-\text{Mar 15}}{\text{Jul 1}-\text{Mar 15}},\ 0,\ 1\right)
\end{aligned}`

const factorRows = [
  {
    name: 'FIP factor',
    formula: String.raw`\left(\dfrac{\text{shrunk FIP}}{3.80}\right)^{0.55}`,
    description: 'FIP is the main pitcher input, but it is first shrunk toward league average when innings are limited and then damped so it cannot dominate the whole model by itself.',
    source: 'MLB Stats API',
  },
  {
    name: 'K% factor',
    formula: String.raw`\operatorname{clamp}\!\left(1 + 0.3\,\dfrac{0.23 - \text{shrunk }K\%}{0.23},\ 0.85,\ 1.15\right)`,
    description: 'Strikeout rate is shrunk toward league average by batters faced, then clamped so a single extreme K% cannot swing the estimate by more than ±15%.',
    source: 'MLB Stats API',
  },
  {
    name: 'Barrel factor',
    formula: String.raw`\left(\dfrac{\text{shrunk barrel rate}}{8.0\%}\right)^{0.35}`,
    description: 'Barrel rate captures contact quality, but it overlaps with FIP, so it is shrunk by innings pitched and applied as a softer secondary adjustment.',
    source: 'Baseball Savant',
  },
  {
    name: 'OBP factor',
    formula: String.raw`\left(\dfrac{\text{shrunk team OBP}}{0.310}\right)^{0.70}`,
    description: 'Season team OBP still anchors baseline offense, and the stabilization sample is heavier in April and May so tiny samples do not move the model too aggressively.',
    source: 'MLB Stats API',
  },
  {
    name: 'Top-3 lineup factor',
    formula: String.raw`\left(\operatorname{clamp}\!\left(\dfrac{\text{shrunk top-3 OBP}}{\text{team OBP}},\ 0.90,\ 1.12\right)\right)^{0.45}`,
    description: 'When a confirmed lineup is available, the first three hitters add a modest relative adjustment on top of the team baseline. If no confirmed order is posted, this factor stays neutral.',
    source: 'MLB Stats API',
  },
  {
    name: 'Park factor',
    formula: String.raw`\left(\text{park factor}\right)^{0.50}`,
    description: 'Park context still matters, but it is damped rather than fully multiplied so the venue informs the number without dictating it.',
    source: 'FanGraphs',
  },
  {
    name: 'Temp factor',
    formula: String.raw`T<55^\circ\!F\to0.92,\ T>80^\circ\!F\to1.06,\ \text{else }1.00`,
    description: 'Cold air suppresses carry and hot air helps it slightly. Fixed-roof and retractable-roof parks are treated as neutral to avoid fake weather edge when roof state is unknown.',
    source: 'Open-Meteo',
  },
  {
    name: 'Wind factor',
    formula: String.raw`\ge10\ \mathrm{mph}:\ \text{in}\to0.93,\ \text{out}\to1.08,\ \text{cross}\to1.00`,
    description: 'Wind direction is resolved relative to each park\'s outfield orientation, then the total weather effect is damped so one forecast input cannot create an unrealistic number.',
    source: 'Open-Meteo',
  },
] as const

export default function MethodologyView() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-slate-700 sm:py-8">

      {/* Intro */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-900 mb-2">How the model works</h2>
        <p className="text-slate-500 leading-relaxed">
          YRFI uses a{' '}
          <a
            href="https://www.geeksforgeeks.org/maths/poisson-distribution/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 underline decoration-slate-300 decoration-1 underline-offset-2 transition-colors hover:text-slate-800 hover:decoration-slate-400"
          >
            Poisson probability model
          </a>{' '}
          to estimate the likelihood that at least one run
          scores in the first inning of each game. Each half-inning is modeled independently,
          then combined. The output is the minimum American odds at which a YRFI bet has positive expected value.
        </p>
      </div>

      {/* Step 1 */}
      <Section title="Step 1 — Estimate λ (expected runs) for each half-inning">
        <p className="mb-3 leading-relaxed">
          <InlineMath math={String.raw`\lambda`} /> represents the expected number of runs scored by one team in the first inning.
          The model starts from a baseline of <InlineMath math="0.36" />, which corresponds to roughly a
          league-average YRFI rate of <InlineMath math="51.4\%" />, and then adjusts that baseline with seven
          stabilized inputs plus a lineup-aware top-of-order tweak when a confirmed batting order is posted.
        </p>
        <FormulaBlock math={lambdaMath} align="left" className="mb-6" />

        <FactorTable factors={factorRows} />

        <p className="mt-4 leading-relaxed">
          Early-season shrinkage is date-adjusted rather than fixed. Each base stabilization sample is multiplied by:
        </p>
        <FormulaBlock math={stabilizationMath} align="left" className="mt-3 mb-3" />
        <p className="text-slate-500 text-xs leading-relaxed">
          That means April samples are pulled harder toward league average, and the extra shrinkage fades linearly to neutral by July 1.
        </p>

        <p className="mt-4 text-slate-500 text-xs leading-relaxed">
          Each team&apos;s <InlineMath math={String.raw`\lambda`} /> uses that team&apos;s OBP and the <em>opposing</em>
          {' '}pitcher&apos;s stats,
          because the home team bats against the away starter, and vice versa. If a confirmed lineup is available,
          the model also compares that team&apos;s top three hitters against its broader team baseline rather than treating
          every batting order as interchangeable.
          The raw adjustment is then bounded to keep the model in a realistic MLB range, and league-average
          values are only used when the starter identity or a required stat feed is actually missing.
        </p>
      </Section>

      {/* Step 2 */}
      <Section title="Step 2 — Compute P(YRFI) from both λ values">
        <p className="mb-3 leading-relaxed">
          Under a Poisson model, the probability of scoring <em>zero</em> runs given expected rate{' '}
          <InlineMath math={String.raw`\lambda`} /> is <InlineMath math={String.raw`e^{-\lambda}`} />. YRFI hits
          when <em>either</em> team scores, so:
        </p>
        <FormulaBlock math={yrfiMath} className="mb-3" />
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          This assumes independence between the two half-innings, which is a reasonable approximation
          since different batters face different pitchers. At league-average inputs both half-innings have
          <InlineMath math={String.raw`\lambda = 0.36`} />, which gives <InlineMath math={String.raw`P(\mathrm{YRFI}) = 1 - e^{-0.72} \approx 51.3\%`} />.
        </p>
      </Section>

      {/* Step 3 */}
      <Section title="Step 3 — Convert probability to break-even American odds">
        <p className="mb-3 leading-relaxed">
          The &quot;Bet at&quot; column shows the worst odds at which a YRFI bet still has positive expected
          value. If the sportsbook offers better odds than this, the bet is +EV.
        </p>
        <FormulaBlock math={oddsMath} className="mb-3" />
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          The ceiling function is used instead of rounding so the threshold is always conservative,
          you need odds <em>at least</em> this good, not just approximately this good.
          A <Mono>~</Mono> prefix means one or both pitchers were TBD or the model had to fall back
          to league-average inputs because pitcher data was missing,
          treat those numbers as estimates.
        </p>
      </Section>

      {/* Caveats */}
      <Section title="What the model doesn&apos;t capture">
        <ul className="list-outside space-y-1.5 pl-5 text-slate-500 leading-relaxed marker:text-slate-400">
          <li>Full lineup context beyond the confirmed top three hitters</li>
          <li>Bullpen usage or opener strategies</li>
          <li>In-game factors like pitch count, injury, or weather changes mid-game</li>
          <li>Umpire tendencies or day/night splits</li>
          <li>Early-season data is stabilized, but still noisier than midseason</li>
        </ul>
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          A value screen, not a guarantee.
          Check lineup news before betting.
        </p>
      </Section>

      {/* Sources */}
      <Section title="Data sources">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { name: 'MLB Stats API', url: 'https://github.com/toddrob99/MLB-StatsAPI', detail: 'Provides schedule data, pitcher season stats for FIP inputs, and team OBP. Free to use with no key required.' },
            { name: 'Baseball Savant', url: 'https://baseballsavant.mlb.com', detail: 'Provides Statcast barrel rate and hard-hit rate data through free CSV downloads.' },
            { name: 'FanGraphs', url: 'https://www.fangraphs.com/guts.aspx?type=pfh', detail: 'Provides park factors on a 1.00 scale. These values are hardcoded by season and updated annually.' },
            { name: 'Open-Meteo', url: 'https://open-meteo.com', detail: 'Provides hourly temperature, wind speed, and wind direction forecasts. Free to use with no key required.' },
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

function FormulaBlock({
  math,
  align = 'center',
  className = '',
}: {
  math: string
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div className={`methodology-formula methodology-formula--${align} overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 ${className}`}>
      <BlockMath math={math} />
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
}

function FactorTable({ factors }: {
  factors: ReadonlyArray<{ name: string; formula: string; description: string; source: string }>
}) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {factors.map(f => (
          <article key={f.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="text-sm font-semibold text-slate-800">{f.name}</div>
            <div className="methodology-inline-formula mt-2 overflow-hidden rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              <InlineMath math={f.formula} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{f.description}</p>
            <div className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">{f.source}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 sm:block">
        <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider w-[130px]">Factor</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider w-[260px]">Formula</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-wider">Rationale</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f, i) => (
            <tr key={f.name} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
              <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap align-top">{f.name}</td>
              <td className="px-4 py-3 align-top text-slate-600">
                <div className="methodology-inline-formula overflow-hidden">
                  <InlineMath math={f.formula} />
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500 leading-relaxed align-top">{f.description}</td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  )
}
