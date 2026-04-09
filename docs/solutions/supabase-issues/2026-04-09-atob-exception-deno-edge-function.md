---
title: "atob() throws synchronously for invalid base64 in Deno Edge Functions — unhandled 500"
date: 2026-04-09
category: supabase-issues
severity: high
stack:
  - Supabase
  - Deno
  - TypeScript
tags:
  - edge-function
  - base64
  - binary-data
  - error-handling
status: verified
last_verified: 2026-04-09
---

# `atob()` rzuca synchroniczny wyjątek dla invalid base64 w Deno Edge Functions

## Symptomy

- Edge Function zwraca HTTP 500 zamiast 400 gdy klient wysyła niepoprawny base64
- Błąd nie jest logowany jako obsługiwany — pojawia się jako unhandled exception
- Klient widzi generyczny "Internal Server Error" bez wskazówki co poszło nie tak
- Problem trudny do reprodukcji w testach jeśli nie testuje się truncated/corrupted payloads

## Root Cause

`atob()` w Deno (i przeglądarkach) rzuca **synchroniczny** wyjątek `DOMException: Failed to execute 'atob'` dla niepoprawnego base64. Gdy catch block w kodzie obsługuje tylko specyficzne wyjątki (np. AWS SDK errors), `atob()` exception propaguje jako unhandled i powoduje 500.

Przykład problematycznego kodu:

```typescript
// ❌ ZŁE — atob() może rzucić przed blokiem try
const selfieBytes = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0))

// ...potem gdzieś niżej:
try {
  const result = await rekognition.send(...)
} catch (err) {
  // Ten catch NIE złapie błędu atob() powyżej
  return json({ error: 'AWS unavailable' }, 503)
}
```

## Rozwiązanie

Otoczyć `atob()` własnym try-catch **przed** dalszą logiką, zwrócić czytelny błąd 400:

```typescript
// ✅ DOBRZE
let selfieBytes: Uint8Array
try {
  selfieBytes = Uint8Array.from(atob(body.selfie), c => c.charCodeAt(0))
} catch {
  return json({ error: 'Invalid selfie format' }, 400)
}
```

Dodatkowo — walidować rozmiar base64 string **przed** dekodowaniem (zapobiega wysyłaniu 50MB danych):

```typescript
const MAX_SELFIE_BASE64_LENGTH = 4 * 1024 * 1024 // ~3 MB po dekodowaniu

if (body.selfie.length > MAX_SELFIE_BASE64_LENGTH) {
  return json({ error: 'Selfie too large' }, 400)
}
```

## Komendy diagnostyczne

```bash
# Reprodukcja — wyślij invalid base64 do Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/verify-face \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","selfie":"not-valid-base64!!!"}'

# Powinno zwrócić 400, nie 500
```

## Zapobieganie

- **Zasada:** każde wywołanie `atob()` w Edge Function musi być w try-catch z explicit error response
- Waliduj długość base64 string przed dekodowaniem gdy dane pochodzą z zewnątrz
- Test: dodać test case z truncated/corrupted base64 w unit testach Edge Function
- Wzorzec do stosowania dla każdego binarnego inputu przesyłanego jako base64:

```typescript
function decodeBase64Safe(b64: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  } catch {
    return null
  }
}
```

## Kontekst

Odkryto podczas code review feature'u weryfikacji profilu (face comparison).
Base64-encoded selfie było przesyłane z przeglądarki do Supabase Edge Function.
`atob()` był wywoływany na input z body requestu przed głównym blokiem try-catch obsługującym AWS errors — 
co powodowało że błąd niesiony przez `atob()` nie był przechwytywany.

Środowisko: Deno 1.x (Supabase Edge Functions), AWS SDK v3.
