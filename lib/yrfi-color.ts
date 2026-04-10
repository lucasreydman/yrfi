const MIN_REALISTIC_YRFI = 0.40
const MAX_REALISTIC_YRFI = 0.60
const YRFI_COLOR_CLASSES = [
  'text-[hsl(12_82%_42%)]',
  'text-[hsl(24_82%_42%)]',
  'text-[hsl(36_82%_42%)]',
  'text-[hsl(48_82%_42%)]',
  'text-[hsl(60_82%_38%)]',
  'text-[hsl(78_82%_34%)]',
  'text-[hsl(96_82%_32%)]',
  'text-[hsl(118_82%_32%)]',
  'text-[hsl(145_82%_32%)]',
] as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getYrfiTextClass(probability: number): string {
  const normalized = clamp(
    (probability - MIN_REALISTIC_YRFI) / (MAX_REALISTIC_YRFI - MIN_REALISTIC_YRFI),
    0,
    1,
  )

  const index = Math.round(normalized * (YRFI_COLOR_CLASSES.length - 1))
  return YRFI_COLOR_CLASSES[index]
}