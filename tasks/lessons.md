# Lessons

- When a pricing model is multiplicative, validate the neutral baseline against observed outcomes before tuning feature weights.
- If a methodology claims special-case behavior, encode that explicitly in the data model and tests so docs and implementation do not drift.
- MLB schedule lineup hydration is not reliable on its own for pregame ordering; use the per-game live feed battingOrder plus player seasonStats and keep a neutral fallback when no confirmed order is posted.
- Avoid browser-target regressions from newer CSS text-wrapping properties unless the support matrix explicitly allows them; prefer broadly supported defaults in shared styles.
- For small-screen control panels, prefer a centered modal over an anchored dropdown when viewport clipping is likely; desktop can keep the anchored popover.