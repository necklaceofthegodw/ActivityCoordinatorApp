export const TIERS = [
  { tier: 0, emoji: '🌱', color: 'text-gray-500',  bg: 'bg-gray-100',   min: 0   },
  { tier: 1, emoji: '⚡', color: 'text-green-600', bg: 'bg-green-100',  min: 50  },
  { tier: 2, emoji: '🎯', color: 'text-blue-600',  bg: 'bg-blue-100',   min: 150 },
  { tier: 3, emoji: '🏆', color: 'text-amber-600', bg: 'bg-amber-100',  min: 350 },
  { tier: 4, emoji: '👑', color: 'text-purple-600',bg: 'bg-purple-100', min: 700 },
] as const

export function getTierInfo(tier: number) {
  return TIERS[Math.min(tier, TIERS.length - 1)]
}

export function getNextTierPoints(tier: number): number | null {
  const next = TIERS[tier + 1]
  return next ? next.min : null
}
