---
date: 2026-04-09
feature: feat-profile-verification
plan: docs/plans/2026-04-09-001-feat-profile-verification-plan.md
---

# Code Review — feat: Weryfikacja profilu przez face comparison

## Statystyki

- Plików sprawdzonych: 9
- 🔴 P1 (blocking): 7
- 🟠 P2 (important): 11
- 🟡 P3 (nit): 9

---

## 🔴 P1 — BLOCKING

### 1. RLS Policy pozwala na bypass `is_verified`
**Plik:** Supabase RLS policies (tabela `profiles`)  
**Problem:** Aktualna polityka RLS na `UPDATE` nie ogranicza które kolumny można zmieniać. Każdy zalogowany user może wykonać `supabase.from('profiles').update({ is_verified: true }).eq('id', user.id)` i zweryfikować się bez przechodzenia przez AWS Rekognition.  
**Fix:** Kolumny `is_verified`, `verification_attempts`, `last_attempt_at` powinny być modyfikowalne wyłącznie przez Edge Function (service_role key). Dodać politykę blokującą te pola w UPDATE via anon key.

---

### 2. `atob()` rzuca wyjątek dla niepoprawnego base64 — unhandled 500
**Plik:** `supabase/functions/verify-face/index.ts:129`  
```typescript
const selfieBytes = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0))
```
**Problem:** `atob()` rzuca synchroniczny wyjątek dla invalid base64. Blok catch (linia 150) łapie tylko AWS errors — tutaj exception propaguje jako unhandled 500, zamiast czytelnego 400.  
**Fix:**
```typescript
let selfieBytes: Uint8Array
try {
  selfieBytes = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0))
} catch {
  return json({ error: 'Invalid selfie format' }, 400)
}
```

---

### 3. `canvas.toBlob()` callback z `null` — VerifyPage zawiesza się
**Plik:** `src/features/auth/VerifyPage.tsx:70-76`  
```typescript
canvas.toBlob((blob) => {
  if (!blob) return  // state nie jest aktualizowany → user stuck
  ...
}, 'image/jpeg', 0.85)
```
**Problem:** Jeśli JPEG encoding nie jest wspierany (starsze WebViews), blob jest `null`. State zostaje `captured` ale bez bloba — user nie może ani powtórzyć ani zatwierdzić.  
**Fix:**
```typescript
canvas.toBlob((blob) => {
  if (!blob) {
    setState({ status: 'error', reason: 'unknown' })
    return
  }
  ...
}, 'image/jpeg', 0.85)
```

---

### 4. Attempt inkrementowany PRZED wywołaniem AWS — przepala limit przy błędach sieci
**Plik:** `supabase/functions/verify-face/index.ts:131-136`  
**Problem:** Licznik prób jest aktualizowany przed wywołaniem `CompareFacesCommand`. Jeśli AWS jest niedostępny lub network timeout — attempt przepada mimo że nie było porównania twarzy. User może wyczerpać limit 3 prób przez awarie sieci, nie własne nieudane weryfikacje.  
**Fix:** Przenieść `update({ verification_attempts })` na po wykonaniu AWS call, wyłącznie gdy AWS odpowiedział (match lub no_match). AWS unavailable → 503, bez inkrementacji.

---

### 5. Non-null assertion `canvas.getContext('2d')!`
**Plik:** `src/features/auth/VerifyPage.tsx:68`  
```typescript
canvas.getContext('2d')!.drawImage(video, 0, 0)
```
**Problem:** Narusza coding rules (`no !`). W edge case context może być `null` (np. zbyt wiele aktywnych kontekstów na iOS). Runtime error bez obsługi.  
**Fix:**
```typescript
const ctx = canvas.getContext('2d')
if (!ctx) { setState({ status: 'error', reason: 'camera' }); return }
ctx.drawImage(video, 0, 0)
```

---

### 6. Brak przycisku wyjścia z VerifyPage — user może utknąć
**Plik:** `src/features/auth/VerifyPage.tsx:30-281`  
**Problem:** Routing w App.tsx (linia 203-210) blokuje dostęp do mapy dla niezweryfikowanych. VerifyPage nie ma przycisku "wróć" ani "pomiń". Jeśli user nie ma kamery lub chce odłożyć weryfikację — nie może nigdzie przejść.  
**Fix:** Dodać przycisk "Pomiń na razie" który ustawia `sessionStorage.setItem('verificationPending', 'true')` i naviguje na `/`. Banner na mapie przypomni o dokończeniu.

---

### 7. `limit_reached` bez CTA — user nie wie jak zmienić avatar
**Plik:** `src/features/auth/VerifyPage.tsx:224-229`  
**Problem:** Ekran `limit_reached` wyświetla hint "zmień zdjęcie profilowe" ale nie ma żadnego przycisku. User musi samodzielnie domyślić się jak wrócić do profilu.  
**Fix:** Dodać button `navigate('/')` lub bezpośrednio `navigate('/profile')` z etykietą "Zmień zdjęcie profilowe".

---

## 🟠 P2 — IMPORTANT

### 8. Canvas double encoding — `toDataURL` + `toBlob` oba JPEG
**Plik:** `src/features/auth/VerifyPage.tsx:70-72`  
```typescript
canvas.toBlob((blob) => {
  if (!blob) return
  const dataUrl = canvas.toDataURL('image/jpeg')  // drugie kodowanie!
```
**Problem:** `toBlob` i `toDataURL` są wywoływane na tym samym canvas — dwa razy kodowanie JPEG 1280x720. `dataUrl` jest używany tylko do podglądu (img src).  
**Fix:** `dataUrl` obliczyć raz, wewnątrz toBlob callback: `URL.createObjectURL(blob)` lub `reader.readAsDataURL(blob)`.

---

### 9. `useProfile` bez `staleTime` — nadmiarowe fetche w ActivitySheet i ChatView
**Plik:** `src/features/profile/useProfile.ts`  
**Problem:** Brak `staleTime` = dane stale natychmiast → refetch przy każdym focus. ActivitySheet fetchuje `organizerProfile`, ChatView też — bez cache'owania mogą być wielokrotne wywołania.  
**Fix:** Dodać `staleTime: 60_000` do useProfile.

---

### 10. Redundantny `useProfile(activity.organizer_id)` w ChatView
**Plik:** `src/features/chat/ChatView.tsx:46`  
**Problem:** Organizer jest już w danych activity (`act.organizer_nickname`, `act.organizer_avatar_url`). Dodatkowy hook dla samego `is_verified` generuje osobne zapytanie.  
**Rozważenie:** `get_nearby_activities` RPC nie zwraca `organizer_is_verified`. Opcje: (a) dodać pole do RPC, (b) zaakceptować osobny fetch z cache'em, (c) pominąć badge organizatora w ChatView.

---

### 11. `useNavigate` w ActivitySheet — naruszenie layer boundaries
**Plik:** `src/features/activities/ActivitySheet.tsx:2, 26, 128`  
**Problem:** ActivitySheet jest komponentem UI — nie powinien znać routingu. `navigate('/verify')` bezpośrednio w sheet'cie utrudnia testowanie i reuse.  
**Fix:** Dodać prop `onNavigateToVerify?: () => void`, wywołać go zamiast `navigate`.

---

### 12. `window.confirm()` w ProfilePage — deprecated w PWA
**Plik:** `src/features/profile/ProfilePage.tsx:88`  
**Problem:** `window.confirm()` może być blokowane lub nie wyświetlać się na iOS Safari PWA w trybie standalone. Brak kontroli nad stylem i dostępnością.  
**Fix:** Zastąpić prostym inline modal/confirm UI state (`showAvatarWarning: boolean`).

---

### 13. Brak walidacji body w Edge Function — typ to `string`, nie enum
**Plik:** `supabase/functions/verify-face/index.ts:47-52`  
**Problem:** `body.action` jest typed jako `string` ale nic nie waliduje wartości. Brak walidacji rozmiaru `selfie` — można przesłać >10MB base64 i wywołać timeout.  
**Fix:** Enum check na `action`, max size na `selfie` (~3MB = ~2MB image po base64).

---

### 14. `verificationPending` nie jest czyszczony po udanej weryfikacji
**Plik:** `src/features/auth/VerifyPage.tsx:108-112`  
**Problem:** Po sukces `refreshSession()` aktualizuje profil, ale `sessionStorage.verificationPending` pozostaje `'true'`. Banner na mapie może się nadal pokazywać po weryfikacji do czasu pełnego reload.  
**Fix:** Dodać `sessionStorage.removeItem('verificationPending')` po `data.verified === true`.

---

### 15. `retryAfter` zwrócony z API ale nie wyświetlony w UI
**Plik:** `src/features/auth/VerifyPage.tsx:224-229`  
**Problem:** Edge Function zwraca `retryAfter: ISO string` (o której godzinie można spróbować), ale UI wyświetla tylko generyczny tekst. State ma to pole (`state.retryAfter`) ale jest ignorowany.  
**Fix:** Wyświetlić `new Date(state.retryAfter).toLocaleTimeString()` w ekranie limit_reached.

---

### 16. Avatar fetch fail zaliczany jako 503 — attempt przepada
**Plik:** `supabase/functions/verify-face/index.ts:118-126`  
**Problem:** Jeśli fetch avatara fail'uje (404, CORS), exception jest łapany w bloku catch dla AWS errors → zwraca 503. Attempt jest już inkrementowany (P1#4). Powinien być oddzielny kod błędu przed inkrementacją.

---

### 17. Dwa równoległe requesty do verify-face — race condition na limicie
**Plik:** `supabase/functions/verify-face/index.ts:103-136`  
**Problem:** Check limitu i increment nie są atomowe. Double-click lub retry może sprawić że dwa requesty przejdą przez check jednocześnie (obydwa widzą attempts=0).  
**Fix:** Atomic increment przez Postgres RPC lub optimistic lock na `last_attempt_at`.

---

### 18. 404 profile w Edge Function — VerifyPage nie obsługuje
**Plik:** `src/features/auth/VerifyPage.tsx:106` + `index.ts:99`  
**Problem:** Edge Function zwraca 404 gdy profil nie istnieje (race condition przy setup). VerifyPage nie ma obsługi dla statusu 404 — `res.json()` parsuje body ale brak handlingu dla `error: 'Profile not found'` — user widzi generyczny błąd.

---

## 🟡 P3 — NIT

### 19. `!profile?.is_verified` — `null` i `false` traktowane tak samo
**Plik:** `src/features/activities/ActivitySheet.tsx:126`  
**Problem:** `!profile?.is_verified` jest truthy zarówno gdy `profile === null` (loading) jak i gdy `profile.is_verified === false`. W loading state user widzi "Zweryfikuj konto" zamiast np. spinner.

---

### 20. Duplikat DB update w ProfilePage — avatar_url zapisywany dwa razy
**Plik:** `src/features/profile/ProfilePage.tsx:64, 114`  
**Problem:** Linia 64 robi `update({ avatar_url })` dla walidacji, linia 114 robi `update({ avatar_url, is_verified: false })`. Można scalić w jeden update po walidacji.

---

### 21. ChatView > 300 linii — naruszenie coding rules
**Plik:** `src/features/chat/ChatView.tsx` (~470 linii)  
**Problem:** Plik przekracza limit 300 linii. Posiada 3 taxy, dialogi potwierdzenia, listę uczestników — powinno być rozbite na subkomponenty.

---

### 22. ProfilePage > 300 linii
**Plik:** `src/features/profile/ProfilePage.tsx` (361 linii)  
**Problem:** Podobnie jak ChatView — plik przekracza limit.

---

### 23. Brak `staleTime` w `useParticipants`
**Plik:** `src/features/activities/useParticipants.ts`  
**Problem:** `staleTime: 30_000` jest ustawiony — OK. Ale nowe pole `is_verified` może być stale przez 30s po zmianie statusu (akceptowalne).

---

### 24. `InvalidParameterException` z AWS — błędnie oznaczony jako `no_face`
**Plik:** `supabase/functions/verify-face/index.ts:150-159`  
**Problem:** `InvalidParameterException` może wynikać z niskiej jakości obrazu (`QualityFilter: 'HIGH'`), nie tylko braku twarzy. User widzi "Nie wykryto twarzy" gdy prawdziwą przyczyną jest słabe oświetlenie/rozdzielczość.

---

### 25. Nazewnictwo: `isVerified` (camelCase w TS) vs `is_verified` (snake_case w DB)
**Plik:** `src/features/activities/useParticipants.ts:8`  
**Problem:** `Participant.isVerified` jest konsystentny z TypeScript conventions. Brak problemu — tylko dla dokumentacji.

---

### 26. Import organization w VerifyPage
**Plik:** `src/features/auth/VerifyPage.tsx:1-5`  
**Problem:** Brak wyraźnego separatora między grupami importów (external / @lib / local).

---

### 27. Brak exhaustiveness check w VerifyState
**Plik:** `src/features/auth/VerifyPage.tsx`  
**Problem:** Discriminated union nie ma `assertNever()` w JSX — kompilator nie ostrzeże jeśli nowy status nie jest obsłużony.

---

## Odchylenia od planu

| Unit | Plan | Implementacja | Ocena |
|------|------|---------------|-------|
| Unit 6 | FAB w MapView szary/kłódka dla niezweryfikowanych | Interceptowanie `onCreateActivity` w App.tsx + toast + navigate | ✅ Akceptowalne — bardziej intuicyjne |
| Unit 6 | Modyfikacja MapView.tsx | MapView.tsx niezmieniony | ✅ OK (implementacja via App.tsx) |

---

## Verdict

⛔ **WYMAGA POPRAWEK — 7 problemów P1 blokujących deployment**

Najkrytyczniejsze: RLS bypass (#1), brak exit z VerifyPage (#6), atob exception (#2).
