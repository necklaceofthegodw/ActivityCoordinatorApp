import type { ActivityCategory } from './database.types'

export const ALL_CATEGORIES: { value: ActivityCategory; emoji: string }[] = [
  { value: 'walk',        emoji: '🚶' },
  { value: 'coffee',      emoji: '☕' },
  { value: 'squash',      emoji: '🎾' },
  { value: 'running',     emoji: '🏃' },
  { value: 'language',    emoji: '📚' },
  { value: 'skateboard',  emoji: '🛹' },
  { value: 'cycling',     emoji: '🚴' },
  { value: 'yoga',        emoji: '🧘' },
  { value: 'climbing',    emoji: '🧗' },
  { value: 'swimming',    emoji: '🏊' },
  { value: 'basketball',  emoji: '🏀' },
  { value: 'volleyball',  emoji: '🏐' },
  { value: 'chess',       emoji: '♟️' },
  { value: 'cooking',     emoji: '🍳' },
  { value: 'hiking',      emoji: '⛰️' },
  { value: 'photography', emoji: '📷' },
  { value: 'music',       emoji: '🎵' },
  { value: 'board_games', emoji: '🎲' },
  { value: 'gym',         emoji: '💪' },
  { value: 'dancing',     emoji: '💃' },
  { value: 'other',       emoji: '✨' },
]

export const CATEGORY_MAP = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.value, c])
) as Record<ActivityCategory, { value: ActivityCategory; emoji: string }>
