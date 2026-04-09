---
date: 2026-04-08
topic: i18n-lokalizacja
---

# Internacjonalizacja (i18n) — PL/EN

## Problem
Aplikacja ma wszystkie teksty UI hardcoded po polsku (~60+ stringów w 22 plikach). Użytkownicy z nie-polskim locale przeglądarki nie mogą wygodnie korzystać z apki. Potrzebna jest obsługa dwóch języków (PL/EN) z automatyczną detekcją i możliwością ręcznego przełączenia.

## Wymagania
- R1. App automatycznie wykrywa język z `navigator.language` — jeśli zaczyna się od `pl` → polski, wszystko inne → angielski
- R2. W ustawieniach profilu (ProfilePage) dostępne są 2 opcje języka: "Z lokalizacji" (domyślne) i "English" (wymuszony angielski)
- R3. Wybór języka zapisywany w localStorage i respektowany przy kolejnych wizytach
- R4. Wszystkie hardcoded polskie stringi w UI zamienione na klucze tłumaczeń (buttony, labele, toasty, walidacje, placeholdery, aria-labels)
- R5. Język zmienia się natychmiast po przełączeniu w ustawieniach (bez przeładowania strony)
- R6. Polski pozostaje domyślnym/fallback językiem — brakujące tłumaczenie EN pokazuje tekst PL

## Kryteria sukcesu
- User z angielskim locale przeglądarki widzi app w 100% po angielsku
- User z polskim locale widzi app po polsku (jak dotychczas)
- User może przełączyć na EN w ustawieniach profilu i zmiana jest natychmiastowa i persystentna
- Zero hardcoded polskich stringów w komponentach React

## Granice scope'u
- Tylko 2 języki: PL i EN (brak innych)
- Bez migracji bazy danych — ustawienie tylko w localStorage
- Bez tłumaczenia treści generowanych przez userów (nazwy aktywności, opisy, wiadomości czatu)
- Bez tłumaczenia Edge Functions / server-side (emaile, logi)
- Bez RTL support

## Kluczowe decyzje
- **react-i18next**: de facto standard, interpolacja, pluralizacja, namespace'y, duże community
- **navigator.language**: najprostsza detekcja, zero dodatkowych API calls
- **localStorage**: wystarczające dla PWA (zazwyczaj jedno urządzenie), bez migracji bazy
- **PL jako fallback**: brak tłumaczenia EN = wyświetla tekst PL, stopniowe dodawanie tłumaczeń jest bezpieczne

## Otwarte pytania

### Odroczone do planowania
- [Dotyczy R4][Techniczne] Dokładna struktura kluczy tłumaczeń — flat vs. nested vs. namespace per feature
- [Dotyczy R4][Wymaga researchu] Czy react-i18next wymaga dodatkowej konfiguracji dla React 19
- [Dotyczy R2][Techniczne] Dokładny UI toggle w ProfilePage — select, radio, czy dedykowana sekcja "Język"

## Następne kroki
→ `/dev-plan` do planowania technicznego implementacji
