---
date: 2026-04-09
topic: profile-verification
---

# Weryfikacja profilu (face comparison)

## Problem
Użytkownicy umawiają się na spotkania przez apkę i potrzebują pewności, że osoba na spotkaniu jest tą z profilu. Brak weryfikacji umożliwia tworzenie fałszywych kont z cudzymi zdjęciami. Cel: bezpieczeństwo spotkań — nie antyspam.

## Wymagania

- **R1.** Tabela `profiles` dostaje pole `is_verified` (boolean, default `false`).
- **R2.** Nowa trasa `/verify` w auth flow: po założeniu profilu (`/setup`) ale przed dostępem do mapy (`/`). Routing: brak sesji → `/login` | sesja bez profilu → `/setup` | profil niezweryfikowany → `/verify` | profil zweryfikowany → `/`.
- **R3.** Ekran `/verify` umożliwia zrobienie selfie kamerą telefonu i wysłanie do porównania z avatarem profilowym.
- **R4.** Avatar musi być ustawiony i zawierać wykrywalną twarz przed weryfikacją — upload avatara bez wykrywalnej twarzy jest odrzucany z czytelnym komunikatem błędu. Jeśli brak avatara, ekran `/verify` kieruje najpierw do edycji profilu.
- **R5.** Porównanie selfie z avatarem odbywa się automatycznie przez zewnętrzne face comparison API (AWS Rekognition lub Azure Face API), wywołane przez Supabase Edge Function (klucze API nigdy nie trafiają do klienta).
- **R6.** Jeśli API potwierdzi zgodność twarzy: `is_verified = true`, użytkownik jest od razu przekierowany na mapę.
- **R7.** Jeśli API odrzuci (twarze nie pasują): użytkownik widzi błąd z liczbą pozostałych prób i sugestią: "Spróbuj zmienić zdjęcie profilowe na wyraźniejsze i spróbuj ponownie jutro."
- **R8.** Limit: maksymalnie 3 próby weryfikacji dziennie (reset o północy). Po wyczerpaniu prób — komunikat z informacją kiedy można spróbować ponownie.
- **R9.** Jeśli face comparison API jest niedostępne (timeout / błąd serwera): użytkownik jest tymczasowo wpuszczany do apki z `is_verified = false`. Na mapie wyświetlany jest banner "Twoje konto czeka na weryfikację" z linkiem do `/verify`. Próba nieudana z powodu niedostępności API nie wlicza się do dziennego limitu.
- **R10.** Tworzenie aktywności (FAB + CreateActivitySheet) jest zablokowane dla niezweryfikowanych użytkowników — UI pokazuje komunikat kierujący do `/verify`.
- **R11.** Dołączenie do aktywności (przycisk Join w ActivitySheet) jest zablokowane dla niezweryfikowanych użytkowników — analogiczny komunikat.
- **R12.** Badge weryfikacji (✓) widoczny przy organizatorze w ActivitySheet oraz na liście uczestników w ustawieniach aktywności (ekran dostępny po dołączeniu).
- **R13.** Zmiana avatara cofa `is_verified = false`. Przed zapisaniem nowego avatara użytkownik widzi ostrzeżenie: "Zmiana zdjęcia profilowego spowoduje utratę weryfikacji — będziesz musiał zweryfikować się ponownie." Po zapisaniu — natychmiastowy redirect na `/verify`.
- **R14.** Selfie jest usuwane z Supabase Storage natychmiast po otrzymaniu odpowiedzi z face comparison API (niezależnie od wyniku).
- **R15.** Migracja: wszyscy użytkownicy istniejący przed wdrożeniem funkcji dostają `is_verified = true` w migracji SQL.

## Kryteria sukcesu
- Niezweryfikowany użytkownik nie może stworzyć ani dołączyć do aktywności (blokada w UI).
- Weryfikacja działa bez udziału admina — decyzja jest w pełni automatyczna.
- Użytkownik który wrzucił poprawne selfie pasujące do avatara dostaje dostęp natychmiast.
- Użytkownik który wyczerpał próby rozumie kiedy może spróbować ponownie i wie jak odblokować się przez zmianę avatara.
- Apka działa (z banerem) nawet gdy face comparison API jest niedostępne.

## Granice scope'u
- Brak liveness detection — świadomie zaakceptowane ograniczenie.
- Brak moderacji ręcznej przez admina.
- Brak weryfikacji dokumentu tożsamości (tylko twarz vs avatar).
- Weryfikacja jednorazowa — po uzyskaniu `is_verified = true` status nie wygasa (chyba że użytkownik zmieni avatar).
- Lista uczestników z badge'ami tylko w istniejącym ekranie ustawień aktywności — nie budujemy nowego widoku.

## Kluczowe decyzje
- **Automated API zamiast manual review**: manual review nieakceptowalny UX i nie skaluje się.
- **Osobny krok `/verify` po `/setup`**: użytkownik może skonfigurować profil przed weryfikacją — nie blokujemy onboardingu, ale blokujemy core features.
- **Avatar wymagany i musi zawierać twarz**: walidacja przy uploadzie, nie dopiero przy weryfikacji.
- **3 próby/dzień**: zabezpieczenie przed brute-force przy złym oświetleniu, bez blokady na stałe.
- **Zmiana avatara = utrata weryfikacji**: jedyna opcja utrzymująca spójność między ✓ a tym co widać na zdjęciu.
- **API-down = tymczasowy dostęp + banner**: dostępność apki ważniejsza niż chwilowe obejście — banner przywraca kontekst.
- **Istniejący użytkownicy = grandfathered**: przymusowa re-weryfikacja całej bazy przy launchu = zbyt duże friction.
- **Selfie usuwane natychmiast**: minimalizacja przechowywania danych biometrycznych, brak potrzeby dłuższego przechowywania.

## Zależności / Założenia
- Supabase Storage skonfigurowany (tymczasowe przechowywanie selfie podczas weryfikacji).
- Avatar upload w ProfileSetupPage istnieje lub musi zostać dodany jako wymagany krok z walidacją twarzy.
- Edge Function wywoływana przez klienta (HTTP POST) — nie cron.
- Lista uczestników w ustawieniach aktywności już istnieje (badge wchodzi tam bez nowego widoku).

## Otwarte pytania

### Do rozwiązania przed planowaniem
- Brak.

### Odroczone do planowania
- [Dotyczy R5][Wymaga researchu] Który konkretny serwis: AWS Rekognition (`CompareFaces`) vs Azure Face API? Sprawdzić koszt i dostępność infrastruktury.
- [Dotyczy R5][Techniczne] Minimalny próg confidence score uznawany za "pasuje" (typowo 80–90% — dobrać empirycznie).
- [Dotyczy R8/R9][Techniczne] Gdzie trzymać licznik prób i timestamp ostatniej próby: nowe kolumny w `profiles` czy osobna tabela?
- [Dotyczy R10/R11][Techniczne] Czy RLS policies dla INSERT na `activities` i `participants` mają sprawdzać `is_verified`, czy tylko frontend gate wystarczy?
- [Dotyczy R4][Techniczne] Face detection przy uploadzie avatara: wywołanie tego samego API co do weryfikacji, czy lżejsza biblioteka client-side (np. face-api.js)?

## Następne kroki
→ `/dev-plan` do planowania technicznego implementacji
