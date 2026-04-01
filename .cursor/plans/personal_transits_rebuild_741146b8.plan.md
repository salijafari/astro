# Personal Transits — clean rebuild (executed)

## Phase 4.5 — Engine sanity check (added per founder)

After `engine.ts` exists, verify **before** wiring overview/detail:

- Prefer **local smoke**: `npx tsx` one-liner or small script importing `computeTransits` with fixture `{ birthDate, sunSign: 'Capricorn', natalChartJson: null, timeframe: 'today' }` — **assert `count > 0`**.
- Optional **temporary** `GET /api/transits/test-engine` may be used during development only; **do not ship** to production (or remove immediately after manual verify).

## Critical implementation notes (locked)

1. **generateCompletion**: `feature`, `complexity`, `messages` (system as `messages[0]` with `role: "system"`). Check `ok` / `kind`; JSON object responseFormat rejects top-level arrays — use `{ summaries: [...] }` wrapper if needed.
2. **Auth**: `c.get("firebaseUid")`, `c.get("dbUserId")` — not `firebaseUser.uid`.
3. **Detail path**: **`/transits/detail/:transitId`** only (never `/transits/:id` alone).
4. **Never empty**: score threshold **30** (not 45) plus **fallback “gentle sky weather”** card if no events pass.
5. **Edit profile CTA**: `/(main)/edit-profile`.

## Premium gate

Transits routes: **no** `hasFeatureAccess` (402 removed) per product decision.
