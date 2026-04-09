---
title: "feat: Weryfikacja profilu przez face comparison"
completed: 2026-04-09
plan: docs/plans/2026-04-09-001-feat-profile-verification-plan.md
brainstorm: docs/dev-brainstorms/2026-04-09-profile-verification-requirements.md
review: docs/reviews/2026-04-09-profile-verification-review.md
---

# Podsumowanie: Weryfikacja profilu

## Co zostało dostarczone

Pełna implementacja weryfikacji tożsamości użytkownika przez porównanie selfie z avatarem profilowym (AWS Rekognition), zgodna z wymaganiami R1–R15.

### Główne komponenty

| Komponent | Plik | Opis |
|-----------|------|------|
| Migracja DB | `supabase/migrations/20260409_add_verification.sql` | Kolumny `is_verified`, `verification_attempts`, `last_attempt_at`; grandfathering istniejących userów |
| Trigger bezpieczeństwa | `supabase/migrations/20260409_protect_verification.sql` | Blokuje bezpośrednie ustawienie `is_verified=true` przez frontend |
| Edge Function | `supabase/functions/verify-face/index.ts` | AWS Rekognition: `validate-avatar` (DetectFaces) + `verify` (CompareFaces 85%) |
| VerifyPage | `src/features/auth/VerifyPage.tsx` | Kamera selfie, discriminated union state, obsługa limitów/API-down |
| Auth routing | `src/App.tsx` | Gate `!is_verified && !verificationPending` → `/verify`; banner na mapie |
| Avatar validation | `src/features/auth/ProfileSetupPage.tsx` | Walidacja twarzy przy setupie |
| Avatar + reset | `src/features/profile/ProfilePage.tsx` | Inline confirm modal, reset `is_verified=false` przy zmianie avatara |
| Join gate | `src/features/activities/ActivitySheet.tsx` | Blokada dołączania dla niezweryfikowanych |
| Create gate | `src/App.tsx` | Intercept `onCreateActivity` → toast + navigate('/verify') |
| Verified badges | `ActivitySheet.tsx`, `ChatView.tsx` | Badge ✓ przy organizatorze i uczestnikach |
| Participants | `src/features/activities/useParticipants.ts` | Dodano `isVerified` do query |

## Kluczowe decyzje architektoniczne

- **Frontend-only gate** (bez RLS dla `is_verified`) — daje kontekstowe komunikaty zamiast generycznych błędów API. Zabezpieczenie: trigger Postgres blokuje bezpośredni bypass przez anon key.
- **Selfie tylko w pamięci** — base64 → Edge Function → AWS → wynik. Selfie nigdy nie trafia do Storage.
- **Jeden Edge Function z `action` param** — `validate-avatar` i `verify` w jednym pliku, jeden klient AWS.
- **`sessionStorage.verificationPending`** — API-down bypass po stronie klienta; czyszczony przy wylogowaniu (`AuthProvider.signOut`) i po udanej weryfikacji.
- **`profile.is_verified === false`** (nie `!profile?.is_verified`) — explicit check odróżnia `null` (loading) od `false` (unverified).
- **Attempt inkrementowany po AWS call** — AWS 503 nie przepala dziennego limitu prób.
- **Inline confirm modal** zamiast `window.confirm()` — PWA-safe, kontrola nad UX.

## Pułapki i przypadki brzegowe

- `atob()` rzuca synchroniczny wyjątek dla invalid base64 — wymaga osobnego try-catch przed blokiem AWS
- `canvas.toBlob()` może zwrócić `null` na starszych WebViews — trzeba obsłużyć jako error state
- `canvas.getContext('2d')` może zwrócić `null` na iOS — nie używać `!` assertion
- `URL.createObjectURL(blob)` zamiast `canvas.toDataURL()` w podglądzie selfie — eliminuje double JPEG encoding
- Supabase Edge Function z service_role bypasses RLS, więc trigger Postgres jest jedynym miejscem gdzie można kontrolować `is_verified` dla authenticated users
- `ProfileSetupPage` nie może upsertować do `profiles` przed `create_profile` RPC — Edge Function musi przyjąć `avatarUrl` w body requestu

## Wymagania wstępne przed deploym

1. `supabase db push` — obie migracje (dodanie kolumn + trigger ochrony)
2. `supabase functions deploy verify-face`
3. Ustawić secrets w Supabase:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (np. `eu-central-1`)
   - `FACE_SIMILARITY_THRESHOLD` (opcjonalnie, default `85`)
