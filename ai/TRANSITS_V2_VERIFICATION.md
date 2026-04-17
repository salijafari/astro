# Personal Transits V2 — verification log (April 2026)

This documents **pass/fail** for roadmap items tied to the implementation in-repo. It is not a substitute for production QA or device matrix testing.

## Phase 0 — Mantra compatibility (pre‑V2 engine)

| # | Check | Result |
|---|--------|--------|
| 1 | `qualityFromTransit(event)` one-arg from mantra uses `transitingBody` | **Pass** — `transitQualityMap.ts` |
| 2 | No `transitQualityMap` → `engine` import | **Pass** |
| 3 | `clearTransitSnapshotsForUser` clears `UserTransitDailyCache` when table exists | **Pass** — `app.ts` |
| 4 | `houseForLongitude` fallback remains `12` | **Pass** — `chartEngine.ts` |

## Schema & cache (Phase A)

| # | Check | Result |
|---|--------|--------|
| 5 | `TransitSnapshot` extended with `dominantEventId`, banner fields optional, `moonContextJson`, `lifecycleVersion` | **Pass** — `schema.prisma` |
| 6 | `UserTransitDailyCache` model + migration `20260417220000_transits_v2_cache_and_snapshot` | **Pass** |
| 7 | `npx prisma generate` succeeds | **Pass** (local) |
| 8 | `npx tsc --noEmit` in `astro-coach-api` | **Pass** |

## Engine V2 (Phase B)

| # | Check | Result |
|---|--------|--------|
| 9 | `buildGentleFallback` removed; empty engine allowed | **Pass** — `engine.ts` |
| 10 | Forward window uses timeframe-scoped days (`today` 3d / `week` 7 / `month` 30) | **Pass** — `getForwardWindowDays` |
| 11 | Stale transits filtered (`window.end < today`) | **Pass** |
| 12 | Optional `transitNatalHouse`, `aspectLifecycle`, `engineVersion` on events | **Pass** |
| 13 | `computeMoonAmbientContext` | **Pass** |
| 14 | `pickDominantTransitForOverview` | **Pass** |

## Satellite services (Phase C)

| # | Check | Result |
|---|--------|--------|
| 15 | `ingressService.computeIngressHints` | **Pass** |
| 16 | `lunationService.computeLunationHints` | **Pass** |
| 17 | `retrogradeService.computeRetrogradeStatus` | **Pass** |

## API (Phase D)

| # | Check | Result |
|---|--------|--------|
| 18 | `GET /transits/overview` returns `dominantEventId`, `moonAmbient`, `lifecycleVersion` | **Pass** |
| 19 | Thin routes registered **before** `/transits/detail/:transitId` | **Pass** — `ingresses`, `lunations`, `retrogrades` |
| 20 | Snapshot upsert persists `dominantEventId`, `moonContextJson` | **Pass** |
| 21 | `upsertUserTransitDailyCache` called on fresh overview compute | **Pass** |

## Mobile (Phase E)

| # | Check | Result |
|---|--------|--------|
| 22 | `planetaryAuroraStops` in `auroraPalette.ts` | **Pass** |
| 23 | `PlanetaryAurora` uses **Reanimated** + `expo-linear-gradient` | **Pass** |
| 24 | `personal-transits.tsx` shows aurora ribbon, moon strip, dominant card highlight | **Pass** |
| 25 | `npx tsc --noEmit` in `astro-coach-app` | **Pass** |

## Not verified in this pass (manual / deferred)

| # | Item | Notes |
|---|------|--------|
| N1 | Full **35-item** product checklist from original PRD | Only roadmap-aligned checks recorded above |
| N2 | LLM guardrails / banned phrases (Phase F) | Not part of this implementation slice |
| N3 | MC index clinical verification vs Swiss Ephemeris docs | TODO remains in `computePlacidusHouses` comment |
| N4 | Production DB migrate | Migration file present; apply via your deployment workflow |

---

**Sign-off:** Typescript strict checks green on API + App for the merged feature set.
