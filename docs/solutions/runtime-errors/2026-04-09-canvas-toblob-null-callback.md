---
title: "canvas.toBlob() wywołuje callback z null na starszych WebViews"
date: 2026-04-09
category: runtime-errors
severity: medium
stack:
  - React
  - TypeScript
tags:
  - canvas
  - blob
  - webcam
  - webview
  - mobile
status: verified
last_verified: 2026-04-09
---

# `canvas.toBlob()` wywołuje callback z `null` na starszych WebViews

## Symptomy

- Przechwytywanie selfie z kamery zawiesza się na "Zrób selfie" bez dalszej reakcji
- Brak komunikatu błędu — UI wygląda jakby nadal działał
- Błąd trudny do reprodukcji na nowych urządzeniach — pojawia się na starszych Androidach (WebView < 90) i niektórych iOS WebViews
- `canvas.toBlob()` wydaje się wywołany, ale nie przechodzi do kolejnego stanu

## Root Cause

`canvas.toBlob(callback, type, quality)` według specyfikacji może wywołać callback z `null` gdy kodowanie się nie powiedzie (np. canvas jest "tainted", brak pamięci, lub MIME type nie jest obsługiwany). Starsze Android WebViews (< 90) i niektóre iOS WebViews mogą zwracać `null` dla `image/jpeg` przy określonych rozmiarach canvas lub ograniczeniach pamięci. Pominięcie null check w callbacku powoduje że stan UI nigdy nie przechodzi dalej.

```typescript
// ❌ ZŁE — null blob powoduje stuck UI
canvas.toBlob((blob) => {
  const dataUrl = URL.createObjectURL(blob!) // TypeError jeśli blob === null
  setState({ status: 'captured', dataUrl, blob: blob! })
}, 'image/jpeg', 0.85)
```

## Rozwiązanie

Zawsze sprawdzaj czy blob jest null w callbacku i ustaw stan błędu:

```typescript
// ✅ DOBRZE
canvas.toBlob((blob) => {
  if (!blob) {
    setState({ status: 'error', reason: 'unknown' })
    return
  }
  const dataUrl = URL.createObjectURL(blob)
  setState({ status: 'captured', dataUrl, blob })
}, 'image/jpeg', 0.85)
```

Dodatkowo — sprawdź `canvas.getContext('2d')` przed wywołaniem `toBlob()`:

```typescript
// canvas.getContext('2d') może zwrócić null na iOS gdy context limit jest osiągnięty
const ctx = canvas.getContext('2d')
if (!ctx) {
  setState({ status: 'error', reason: 'camera' })
  return
}
ctx.drawImage(video, 0, 0)
canvas.toBlob((blob) => {
  if (!blob) {
    setState({ status: 'error', reason: 'unknown' })
    return
  }
  const dataUrl = URL.createObjectURL(blob)
  setState({ status: 'captured', dataUrl, blob })
}, 'image/jpeg', 0.85)
```

## Komendy diagnostyczne

```typescript
// Ręczne testowanie w konsoli przeglądarki
const canvas = document.createElement('canvas')
canvas.width = 640
canvas.height = 480
canvas.toBlob((blob) => {
  console.log('blob:', blob) // null na niektórych WebViews
}, 'image/jpeg', 0.85)
```

## Zapobieganie

- **Zasada:** zawsze sprawdzaj `blob !== null` w callbacku `canvas.toBlob()`
- **Zasada:** zawsze sprawdzaj `ctx !== null` po `canvas.getContext('2d')`
- Nie używaj non-null assertion (`!`) na wyniku `getContext()` ani argumencie callbacku `toBlob()`
- Jeśli `toBlob()` zwraca null — wyświetl komunikat błędu zamiast zawieszać UI

## Kontekst

Odkryto podczas code review feature'u weryfikacji profilu (selfie capture). Canvas był używany do przechwycenia klatki z VideoElement kamery. Na nowych urządzeniach `toBlob()` działał poprawnie, ale analiza kodu ujawniła brak null check który mógłby powodować stuck UI na starszych urządzeniach.

Środowisko: React 19, PWA (standalone mode), mobilne przeglądarki.
