export const TIERS = [
  { tier: 0, emoji: '🌱', color: 'text-fresh-muted', bg: 'bg-fresh-surface', bar: 'bg-fresh-muted', min: 0 },
  { tier: 1, emoji: '⚡', color: 'text-fresh-indigo', bg: 'bg-fresh-soft', bar: 'bg-fresh-garden', min: 50 },
  { tier: 2, emoji: '🎯', color: 'text-fresh-sky', bg: 'bg-fresh-soft', bar: 'bg-fresh-sky', min: 150 },
  { tier: 3, emoji: '🏆', color: 'text-fresh-indigo', bg: 'bg-fresh-moss/50', bar: 'bg-fresh-indigo', min: 350 },
  { tier: 4, emoji: '👑', color: 'text-fresh-plum', bg: 'bg-fresh-moss', bar: 'bg-fresh-plum', min: 700 },
] as const

export function getTierInfo(tier: number) {
  return TIERS[Math.min(tier, TIERS.length - 1)]
}

export function getNextTierPoints(tier: number): number | null {
  const next = TIERS[tier + 1]
  return next ? next.min : null
}
