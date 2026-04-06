import type { ActivityCategory } from './database.types'

export const ALL_CATEGORIES: { value: ActivityCategory; emoji: string; label: string }[] = [
  { value: 'walk',        emoji: '🚶', label: 'Spacer'         },
  { value: 'coffee',      emoji: '☕', label: 'Kawa'           },
  { value: 'squash',      emoji: '🎾', label: 'Squash'         },
  { value: 'running',     emoji: '🏃', label: 'Bieganie'       },
  { value: 'language',    emoji: '📚', label: 'Nauka języka'   },
  { value: 'skateboard',  emoji: '🛹', label: 'Deskorolka'     },
  { value: 'cycling',     emoji: '🚴', label: 'Rower'          },
  { value: 'yoga',        emoji: '🧘', label: 'Yoga'           },
  { value: 'climbing',    emoji: '🧗', label: 'Wspinaczka'     },
  { value: 'swimming',    emoji: '🏊', label: 'Pływanie'       },
  { value: 'basketball',  emoji: '🏀', label: 'Koszykówka'     },
  { value: 'volleyball',  emoji: '🏐', label: 'Siatkówka'      },
  { value: 'chess',       emoji: '♟️', label: 'Szachy'         },
  { value: 'cooking',     emoji: '🍳', label: 'Gotowanie'      },
  { value: 'hiking',      emoji: '⛰️', label: 'Wędrówki'       },
  { value: 'photography', emoji: '📷', label: 'Fotografia'     },
  { value: 'music',       emoji: '🎵', label: 'Muzyka'         },
  { value: 'board_games', emoji: '🎲', label: 'Gry planszowe'  },
  { value: 'gym',         emoji: '💪', label: 'Siłownia'       },
  { value: 'dancing',     emoji: '💃', label: 'Taniec'         },
  { value: 'other',       emoji: '✨', label: 'Inne'           },
]

export const CATEGORY_MAP = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.value, c])
) as Record<ActivityCategory, { value: ActivityCategory; emoji: string; label: string }>
