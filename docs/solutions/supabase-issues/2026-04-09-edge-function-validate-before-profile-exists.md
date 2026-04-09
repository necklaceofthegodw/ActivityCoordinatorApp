---
title: "Edge Function wywołana przed istnieniem rekordu profilu — walidacja avatara przy setup"
date: 2026-04-09
category: supabase-issues
severity: medium
stack:
  - Supabase
  - Deno
  - TypeScript
tags:
  - edge-function
  - profile-setup
  - avatar
  - rpc
  - timing
status: verified
last_verified: 2026-04-09
---

# Edge Function wywołana przed istnieniem rekordu profilu

## Symptomy

- Walidacja avatara (face detection) podczas ustawiania profilu zwraca błąd 404 lub "Profile not found"
- `validate-avatar` action w Edge Function odczytuje `avatar_url` z tabeli `profiles`, ale rekord jeszcze nie istnieje
- Problem pojawia się wyłącznie podczas `ProfileSetupPage` — przy pierwszym logowaniu, przed `create_profile` RPC
- Po zakończeniu setup (rekord profilu istnieje) walidacja działa poprawnie

## Root Cause

Flow tworzenia profilu:
1. Użytkownik wybiera zdjęcie avatara
2. Avatar jest wgrywany do Storage → zwraca `publicUrl`
3. Wywołanie `validate-avatar` Edge Function — **profil NIE istnieje jeszcze w DB**
4. Dopiero po walidacji: `create_profile` RPC tworzy rekord w `profiles`

Jeśli Edge Function próbuje odczytać `avatar_url` z tabeli `profiles` (`.from('profiles').select('avatar_url').eq('id', user.id)`), otrzymuje `null` lub pustą tabelę — profil jeszcze nie istnieje.

```typescript
// ❌ ZŁE — odczytuje avatarUrl z profiles, które może nie istnieć
const { data: profile } = await supabase
  .from('profiles')
  .select('avatar_url')
  .eq('id', user.id)
  .single()

if (!profile?.avatar_url) {
  return json({ error: 'No avatar' }, 400)
}
// Pobierz obraz z profile.avatar_url...
```

## Rozwiązanie

Przekaż `avatarUrl` bezpośrednio w body requesta do Edge Function zamiast odczytywać z bazy. Edge Function powinna akceptować `avatarUrl` jako parametr:

```typescript
// ✅ DOBRZE — avatarUrl przekazywany w body
// Klient (ProfileSetupPage):
const response = await supabase.functions.invoke('verify-face', {
  body: { action: 'validate-avatar', avatarUrl: publicUrl },
})

// Edge Function:
const body = await req.json() as { action: string; avatarUrl?: string }

if (body.action === 'validate-avatar') {
  const avatarUrl = body.avatarUrl
  if (!avatarUrl) {
    return json({ error: 'avatarUrl required' }, 400)
  }
  // Pobierz obraz bezpośrednio z avatarUrl
  const avatarResponse = await fetch(avatarUrl)
  const avatarBytes = new Uint8Array(await avatarResponse.arrayBuffer())
  // ...DetectFaces via AWS Rekognition
}
```

Dla `verify` action (porównanie selfie z avatarem) Edge Function MOŻE odczytać avatar z profilu (profil już istnieje gdy użytkownik przechodzi weryfikację), ale może też przyjąć `avatarUrl` — spójność podejścia ułatwia maintenance.

## Zapobieganie

- **Zasada:** Edge Functions wywoływane podczas onboardingu (setup flow) nie mogą polegać na tym że rekord użytkownika w DB już istnieje
- Przekazuj potrzebne dane bezpośrednio w body requesta zamiast fetchować je z bazy
- Dokumentuj w komentarzu Edge Function jakie dane muszą istnieć w DB przed wywołaniem
- Jeśli Edge Function obsługuje wiele akcji (`validate-avatar` + `verify`), jasno oddziel wymagania każdej akcji

```typescript
// Wzorzec — jasny podział wymagań akcji:
if (body.action === 'validate-avatar') {
  // Nie wymaga rekordu w profiles — avatarUrl z body
  const { avatarUrl } = body
  if (!avatarUrl) return json({ error: 'avatarUrl required' }, 400)
  // ...
} else if (body.action === 'verify') {
  // Wymaga rekordu w profiles (user już przeszedł setup)
  const { data: profile } = await supabase.from('profiles').select('avatar_url, verification_attempts, last_attempt_at').eq('id', user.id).single()
  if (!profile) return json({ error: 'Profile not found' }, 404)
  // ...
}
```

## Kontekst

Odkryto podczas implementacji feature'u weryfikacji profilu. `ProfileSetupPage` waliduje twarz na avatarze **przed** created profilem — wywołuje Edge Function zaraz po wgraniu obrazu do Storage, jeszcze przed `create_profile` RPC. Poprzednia implementacja próbowała upsertować `avatar_url` do `profiles` przed RPC, co łamało flow tworzenia profilu (constraint violations, RLS). Poprawne rozwiązanie: przekaż `avatarUrl` w body requesta, bez dotykania DB.
