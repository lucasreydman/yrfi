'use client'

import { BlockMath, InlineMath } from 'react-katex'

const lambdaMath = String.raw`\begin{aligned}
\lambda &= 0.3371 \times A_{\text{bounded}} \\
A_{\text{raw}} &= F_{\text{FIP}} \times F_{K} \times F_{\text{barrel}} \times F_{\text{OBP}} \\
&\quad \times F_{\text{top3}} \times F_{\text{park}} \times F_{\text{weather}} \\
A_{\text{bounded}} &= \operatorname{clamp}(A_{\text{raw}}, 0.55, 1.55)
\end{aligned}`

const yrfiMath = String.raw`\begin{aligned}
P(\mathrm{YRFI}) &= 1 - P(H=0)\,P(A=0) \\
&= 1 - e^{-\lambda_H} e^{-\lambda_A} \\
&= 1 - e^{-(\lambda_H + \lambda_A)}
\end{aligned}`

const oddsMath = String.raw`\begin{cases}
-\left\lceil \frac{100p}{1-p} \right\rceil & p \ge 0.5 \\
+\left\lceil \frac{100(1-p)}{p} \right\rceil & p < 0.5
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
    mobileFormula: String.raw`\left(\dfrac{\text{shrunk FIP}}{3.80}\right)^{0.55}`,
    description: 'FIP is the main pitcher input, but it is first shrunk toward league average when innings are limited and then damped so it cannot dominate the whole model by itself.',
    source: 'MLB Stats API',
  },
  {
    name: 'K% factor',
    formula: String.raw`\operatorname{clamp}\!\left(1 + 0.3\,\dfrac{0.23 - \text{shrunk }K\%}{0.23},\ 0.85,\ 1.15\right)`,
    mobileFormula: String.raw`\operatorname{clamp}\!\left(1 + 0.3\,\dfrac{0.23-K\%}{0.23},\ 0.85,\ 1.15\right)`,
    description: 'Strikeout rate is shrunk toward league average by batters faced, then clamped so a single extreme K% cannot swing the estimate by more than ±15%.',
    source: 'MLB Stats API',
  },
  {
    name: 'Barrel factor',
    formula: String.raw`\left(\dfrac{\text{shrunk barrel rate}}{8.0\%}\right)^{0.35}`,
    mobileFormula: String.raw`\left(\dfrac{\text{shrunk barrel rate}}{8.0\%}\right)^{0.35}`,
    description: 'Barrel rate captures contact quality, but it overlaps with FIP, so it is shrunk by innings pitched and applied as a softer secondary adjustment.',
    source: 'Baseball Savant',
  },
  {
    name: 'OBP factor',
    formula: String.raw`\left(\dfrac{\text{shrunk team OBP}}{0.310}\right)^{0.70}`,
    mobileFormula: String.raw`\left(\dfrac{\text{shrunk team OBP}}{0.310}\right)^{0.70}`,
    description: 'Season team OBP still anchors baseline offense, and the stabilization sample is heavier in April and May so tiny samples do not move the model too aggressively.',
    source: 'MLB Stats API',
  },
  {
    name: 'Top-3 lineup factor',
    formula: String.raw`\left(\operatorname{clamp}\!\left(\dfrac{\text{shrunk top-3 OBP}}{\text{team OBP}},\ 0.90,\ 1.12\right)\right)^{0.45}`,
    mobileFormula: String.raw`\left(\operatorname{clamp}\!\left(\dfrac{OBP_{top3}}{OBP_{team}},\ 0.90,\ 1.12\right)\right)^{0.45}`,
    description: 'When a confirmed lineup is available, the first three hitters add a modest relative adjustment on top of the team baseline. If no confirmed order is posted, this factor stays neutral.',
    source: 'MLB Stats API',
  },
  {
    name: 'Park factor',
    formula: String.raw`\left(\text{park factor}\right)^{0.50}`,
    mobileFormula: String.raw`\left(\text{park factor}\right)^{0.50}`,
    description: 'Park context still matters, but it is damped rather than fully multiplied so the venue informs the number without dictating it.',
    source: 'FanGraphs',
  },
  {
    name: 'Temp factor',
    formula: String.raw`T<55^\circ\!F\to0.92,\ T>80^\circ\!F\to1.06,\ \text{else }1.00`,
    mobileFormula: String.raw`\begin{aligned}
T<55^\circ\!F&\to0.92\\
T>80^\circ\!F&\to1.06,\ \mathrm{else}\to1.00
\end{aligned}`,
    description: 'Cold air suppresses carry and hot air helps it slightly. Fixed-roof and retractable-roof parks are treated as neutral to avoid fake weather edge when roof state is unknown.',
    source: 'Open-Meteo',
  },
  {
    name: 'Wind factor',
    formula: String.raw`\ge10\ \mathrm{mph}:\ \text{in}\to0.93,\ \text{out}\to1.08,\ \text{cross}\to1.00`,
    mobileFormula: String.raw`\begin{aligned}
\ge10\ \mathrm{mph}:\ &\mathrm{in}\to0.93,\ \mathrm{out}\to1.08\\
&\mathrm{cross}\to1.00
\end{aligned}`,
    description: 'Wind direction is resolved relative to each park\'s outfield orientation, then the total weather effect is damped so one forecast input cannot create an unrealistic number.',
    source: 'Open-Meteo',
  },
] as const

const caveats = [
  'Full lineup context beyond the confirmed top three hitters',
  'Bullpen usage or opener strategies',
  'In-game factors like pitch count, injury, or weather changes mid-game',
  'Umpire tendencies or day/night splits',
  'Early-season data is stabilized, but still noisier than midseason',
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

      <Section title="Why YRFI?">
        <p className="leading-relaxed text-slate-600">
          The starting point for this project is simple: books often shade extra vig into NRFI because it is the cleaner,
          more popular public bet. A scoreless first inning feels intuitive, casual bettors gravitate to it, and that demand
          can make the opposite side more interesting than it looks at first glance.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-700">Public bias</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              NRFI is a heavily favored public betting angle because rooting for no runs feels safer than betting on instant offense.
              That popularity gives sportsbooks room to price NRFI aggressively.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-700">Pricing effect</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              When books lean into that demand, YRFI can become the less fashionable side with the more interesting price.
              The edge is not that YRFI wins more often, it is that the offered odds can be better than the true probability implies.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-green-700">Model goal</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This model exists to estimate fair YRFI probability first, then convert that into a break-even American price.
              If the market offers a better number than that threshold, the bet is theoretically +EV.
            </p>
          </article>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          That does not mean every YRFI is good or that every NRFI is bad. It means the question is about price, not just outcome.
          The methodology below is built to answer that pricing question in a consistent way.
        </p>
      </Section>

      {/* Step 1 */}
      <Section title="Step 1 — Estimate λ (expected runs) for each half-inning">
        <p className="mb-3 leading-relaxed">
          <InlineMath math={String.raw`\lambda`} /> represents the expected number of runs scored by one team in the first inning.
          The model starts from a baseline of <InlineMath math="0.3371" /> for one team&apos;s half-inning.
          That neutral prior was recalibrated from every completed MLB regular-season game in the pitch-clock era
          from 2023 through 2025: <InlineMath math="3575 / 7290 \approx 49.05\%" /> YRFI and <InlineMath math="50.95\%" /> NRFI.
          The model then adjusts each half-inning baseline with seven stabilized inputs plus a lineup-aware top-of-order
          tweak when a confirmed batting order is posted.
        </p>
        <FormulaBlock math={lambdaMath} align="left" className="mb-6" />

        <FactorTable factors={factorRows} />

        <p className="mt-4 leading-relaxed">
          Early-season shrinkage is date-adjusted rather than fixed. Each base stabilization sample is multiplied by:
        </p>
        <FormulaBlock math={stabilizationMath} align="left" className="mt-3 mb-3" />
        <p className="text-slate-500 text-xs leading-relaxed">
          That means April samples are pulled harder toward league average, and the extra shrinkage fades linearly to neutral by July.
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
          <InlineMath math={String.raw`\lambda = 0.3371`} />, which gives <InlineMath math={String.raw`P(\mathrm{YRFI}) = 1 - e^{-0.6742} \approx 49.05\%`} />.
        </p>
      </Section>

      {/* Step 3 */}
      <Section title="Step 3 — Convert probability to break-even American odds">
        <p className="mb-3 leading-relaxed">
          The &quot;Bet at&quot; column shows the worst odds at which a YRFI bet still has positive expected
          value. If the sportsbook offers better odds than this, the bet is +EV.
        </p>
        <OddsFormulaBlock math={oddsMath} className="mb-3" />
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          The ceiling function is used instead of rounding so the threshold is always conservative,
          you need odds <em>at least</em> this good, not just approximately this good.
          A <Mono>~</Mono> prefix means one or both probable starters are still TBD, or a named starter still relies on fallback pitcher inputs.
          Odds stay visible unless a probable starter is still TBD.
        </p>
      </Section>

      {/* Caveats */}
      <Section title="What the model doesn&apos;t capture">
        <ul className="space-y-2 text-slate-500 leading-relaxed">
          {caveats.map(caveat => (
            <li key={caveat} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-[0.55rem] block size-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{caveat}</span>
            </li>
          ))}
        </ul>
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

function OddsFormulaBlock({ math, className = '' }: { math: string; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="shrink-0 whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:w-28 sm:pt-2">
          Break-even odds
        </div>
        <div className="methodology-formula methodology-formula--left methodology-formula--odds min-w-0 flex-1 overflow-hidden text-slate-800">
          <BlockMath math={math} />
        </div>
      </div>
    </div>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
}

function FactorTable({ factors }: {
  factors: ReadonlyArray<{ name: string; formula: string; mobileFormula?: string; description: string; source: string }>
}) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {factors.map(f => (
          <article key={f.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
            <div className="text-sm font-semibold text-slate-800">{f.name}</div>
            <div className="methodology-card-formula mt-2 overflow-hidden rounded-lg bg-slate-50 px-2 py-2 text-slate-700">
              <BlockMath math={f.mobileFormula ?? f.formula} />
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
