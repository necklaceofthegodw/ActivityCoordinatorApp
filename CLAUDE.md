# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + Vite build
npm run typecheck    # tsc --noEmit only
npm run lint         # ESLint
npm run preview      # Preview production build
```

No test runner is configured — there are no tests in the project.

**Supabase Edge Functions** are written in Deno (TypeScript) and live in `supabase/functions/`. Deploy via Supabase CLI (`supabase functions deploy <name>`). They are not bundled by Vite.

## Architecture

**Stack:** React 19 + TypeScript + Vite SPA, TailwindCSS v4, React Query v5, React Router v7, Supabase (auth + database + Edge Functions), PWA (vite-plugin-pwa), react-leaflet for maps.

**Path alias:** `@/` → `src/`

### Feature structure (`src/features/`)

Each feature folder owns its components and hooks:

- `auth/` — `AuthProvider` (React Context wrapping Supabase auth state + profile fetch), `LoginPage`, `ProfileSetupPage`
- `activities/` — sheets for viewing/creating activities, all data-fetching hooks (`useActivities`, `useMyActivities`, `useActivityById`, `useCreateActivity`, `useJoinActivity`, `useLeaveActivity`, `useDeleteActivity`, `useParticipants`, etc.)
- `map/` — `MapView` (react-leaflet map, renders activity markers, handles click-to-create), `CategoryFilter`, `CategoryPicker`, `RadiusSlider`, `useUserLocation`
- `chat/` — `ChatView`, `useChat`
- `profile/` — `ProfilePage`
- `reports/` — reporting feature
- `game/` — `FlappyBird` mini-game

### Core lib (`src/lib/`)

- `supabase.ts` — typed Supabase client (requires `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`)
- `database.types.ts` — generated Supabase types (source of truth for all DB types, including the `ActivityCategory` union)
- `categories.ts` — `ALL_CATEGORIES` array + `CATEGORY_MAP` lookup
- `tiers.ts` — 5-tier user ranking system (Nowicjusz → Legenda, based on points)

### Auth flow

`App.tsx` wraps everything in `AuthProvider`. `AppRoutes` gates routes on `session` and `profile`: no session → `/login`, session but no profile → `/setup`, profile but `!is_verified && !verificationPending` → `/verify`, verified → `/` (MapPage). Deep-linked `/activity/:id` routes store the ID in `sessionStorage` as `pendingActivityId` and redirect after login/setup.

**Verification flow:** New users are routed to `/verify` after profile setup. `/verify` captures a selfie via camera, sends it as base64 to the `verify-face` Supabase Edge Function, which uses AWS Rekognition `CompareFaces` against the user's avatar (85% similarity threshold, max 3 attempts/day). Success → `is_verified = true` → `refreshSession()` → AuthProvider re-fetches profile → routing redirects to map.

**API-down state:** If Edge Function returns 503, `sessionStorage.setItem('verificationPending', 'true')` is set and user gets access to the map with a banner prompt. This flag is cleared on sign-out (`AuthProvider.signOut`) and on successful verification.

**Security:** A Postgres trigger (`prevent_self_verification`) blocks direct `is_verified = true` updates via the anon/authenticated key. The Edge Function uses `service_role` key which bypasses RLS and the trigger check, so only server-side code can grant verification.

### Data fetching pattern

All server state is managed through React Query hooks. The main `useActivities` hook calls the `get_nearby_activities` Supabase RPC function. Activities are client-side filtered to hide those that started > 2 hours ago (unless user is organizer/participant). Polling interval is 30s.

### Activity lifecycle (Edge Function)

`supabase/functions/activity-lifecycle/index.ts` is a Deno Edge Function (no HTTP params — designed for a cron trigger) that:
1. Expires open activities past `scheduled_at` with only the organizer (`current_participants = 1`)
2. Archives open/full activities that are > 2 hours past `scheduled_at`

It uses `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `ADMIN_EMAIL` env vars.

### Activity visibility rules

- Future activities: visible to all
- 0–2h past `scheduled_at`: only organizer or participants
- 2h+ past `scheduled_at`: hidden (archived/expired server-side by Edge Function)

### PWA & mobile

The app is a PWA with `standalone` display mode. `--app-height` and `--top-inset` CSS vars are set via `visualViewport` events in `App.tsx` to handle mobile keyboard/browser chrome. Use `style={{ height: 'var(--app-height, 100svh)' }}` for full-height containers, not `h-screen`.

### Verification Edge Function (`verify-face`)

`supabase/functions/verify-face/index.ts` handles two actions:
- `validate-avatar` — `DetectFacesCommand` on the avatar URL (accepts optional `avatarUrl` in body for ProfileSetupPage where profile doesn't exist yet)
- `verify` — `CompareFacesCommand` selfie vs avatar, 85% threshold, `QualityFilter: 'HIGH'`

Selfie is passed as base64 in the request body — never stored in Supabase Storage. Attempt counter increments only after a real AWS comparison result (not on AWS 503 or avatar fetch failures).

Required env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `FACE_SIMILARITY_THRESHOLD` (default `85`).

### Activity limits & tiers

Users have a limit on concurrent active activities (enforced via `useMyActivities` returning `isAtLimit`). The tier system (0–4) is point-based and defined in `src/lib/tiers.ts`.

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance