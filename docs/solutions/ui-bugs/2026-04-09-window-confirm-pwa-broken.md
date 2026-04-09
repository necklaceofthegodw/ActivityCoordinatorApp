---
title: "window.confirm() zawiesza się lub nie działa w PWA standalone mode"
date: 2026-04-09
category: ui-bugs
severity: high
stack:
  - React
  - TypeScript
tags:
  - pwa
  - standalone
  - dialog
  - modal
  - confirm
status: verified
last_verified: 2026-04-09
---

# `window.confirm()` zawiesza się lub nie działa w PWA standalone mode

## Symptomy

- `window.confirm()` nie wyświetla dialogu w PWA zainstalowanej jako standalone (Add to Home Screen)
- Na niektórych urządzeniach iOS dialog pojawia się, ale po kliknięciu "OK" i "Cancel" zwraca zawsze `false`
- Akcja destruktywna (np. usunięcie, zmiana awatara) wykonuje się natychmiast bez potwierdzenia, lub nigdy
- Problem trudny do reprodukcji w przeglądarce (developer mode) — pojawia się dopiero po instalacji jako PWA

## Root Cause

W trybie `standalone` (display mode w web app manifest) część przeglądarek mobilnych (głównie iOS Safari/WebKit oraz starsze Android WebViews) blokuje lub zmienia zachowanie natywnych dialogów (`alert`, `confirm`, `prompt`). Standard nie gwarantuje działania tych API poza kontekstem pełnej przeglądarki. Chrome na Androidzie zazwyczaj działa, ale iOS WebKit w standalone mode ignoruje je lub zwraca domyślną wartość.

## Rozwiązanie

Zastąp `window.confirm()` własnym inline modal komponentem renderowanym w React tree. Użyj lokalnego stanu do zarządzania widocznością i callbackiem potwierdzenia.

```typescript
// ❌ ZŁE — zawodzi w PWA standalone
function handleAvatarChange(file: File) {
  if (!window.confirm(t('profile.avatarChangeWarning'))) return
  void processUpload(file)
}

// ✅ DOBRZE — inline modal z własnym stanem
const [showWarning, setShowWarning] = useState(false)
const [pendingFile, setPendingFile] = useState<File | null>(null)

function handleAvatarChange(file: File) {
  if (profile?.is_verified) {
    setPendingFile(file)
    setShowWarning(true)
    return
  }
  void processUpload(file)
}

// W JSX:
{showWarning && pendingFile && (
  <div className="absolute inset-0 z-[1010] flex items-center justify-center bg-black/40 px-6">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
      <h3 className="mb-2 text-base font-semibold">{t('profile.avatarChangeTitle')}</h3>
      <p className="mb-6 text-sm text-gray-600">{t('profile.avatarChangeWarning')}</p>
      <div className="flex gap-3">
        <button
          onClick={() => { setShowWarning(false); setPendingFile(null) }}
          className="flex-1 rounded-xl border py-2.5 text-sm font-medium"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={() => {
            setShowWarning(false)
            void processUpload(pendingFile)
            setPendingFile(null)
          }}
          className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white"
        >
          {t('common.confirm')}
        </button>
      </div>
    </div>
  </div>
)}
```

## Komendy diagnostyczne

```bash
# Sprawdź display mode w manifeście
cat public/manifest.json | grep display

# Zreprodukuj w standalone: zainstaluj PWA na iOS lub Android,
# następnie uruchom akcję wymagającą window.confirm()
```

## Zapobieganie

- **Zasada:** nigdy nie używaj `window.alert()`, `window.confirm()`, `window.prompt()` w PWA
- Zamień wszystkie istniejące `window.confirm()` na inline modalne komponenty
- Dla potrzeb globalnych: rozważ stworzenie `useConfirm()` hooka z kontekstem i single modal rendererem w root

```typescript
// Wzorzec do reużycia — prosty inline confirm state
const [confirmState, setConfirmState] = useState<{
  open: boolean
  message: string
  onConfirm: (() => void) | null
}>({ open: false, message: '', onConfirm: null })

function requestConfirm(message: string, onConfirm: () => void) {
  setConfirmState({ open: true, message, onConfirm })
}
```

## Kontekst

Odkryto podczas implementacji feature'u weryfikacji profilu. Zmiana awatara profilowego cofa weryfikację (`is_verified = false`), więc wymagało to ostrzeżenia użytkownika przed potwierdzeniem. Oryginalna implementacja używała `window.confirm()`, które działało w przeglądarce ale zawodzi w PWA standalone mode (Add to Home Screen na iOS/Android).
