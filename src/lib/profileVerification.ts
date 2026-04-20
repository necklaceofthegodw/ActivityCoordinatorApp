function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return defaultValue
}

export const REQUIRE_PROFILE_VERIFICATION = parseBooleanEnv(
  import.meta.env.VITE_REQUIRE_PROFILE_VERIFICATION,
  false,
)
