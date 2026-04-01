# Akhtar — debugging protocol

## The rule

Never write a fix based on a guess.
Every fix must be based on observed evidence from logs, database, or network.

## Step 1: Identify the error type

404 on an API route:
→ The route does not exist OR is registered after a wildcard in app.ts.
→ grep -n "app\.route\|app\.use\|wildcard\|\.\(\'\*\'\)" astro-coach-api/src/app.ts
→ Find where the route is registered. Move it before any wildcard.

500 on an API route:
→ The handler is crashing. Check Railway logs for the exact error.
→ Railway → astro service → Deploy Logs → search for the route path.

Saved but not persisting:
→ Check if the PUT request actually fired (Network tab in DevTools).
→ If no PUT in network: frontend is returning early before fetch (validation blocking).
→ If PUT fired: check Railway logs to confirm the write happened.
→ If write happened: profile cache is serving stale data, call invalidateProfileCache().

"Complete your profile" error when profile exists:
→ Prisma query is missing include: { birthProfile: true }
→ Show the findUnique call. Add the include.

LLM returning wrong language:
→ Language instruction is too weak. Make it forceful (see FIELD_NAMES.md).
→ Check user.language value in database — default should be 'fa' not null.

sweph crash causing 500:
→ sweph data files are not on Railway.
→ Wrap ALL sweph calls in try/catch. Return graceful fallback, never 500.

## Step 2: Get the evidence

Railway logs:
→ Railway → astro → Deploy Logs → reproduce the action → read the output

Prisma Studio (database state):
→ cd astro-coach-api && npx prisma studio
→ Check the actual field values — do not assume

Browser Network tab:
→ Open DevTools → Network → Fetch/XHR
→ Check: was the request sent? What status? What response body?
→ Click the request → Preview tab → read the JSON

Browser Console:
→ Look for red errors and the lines immediately above them

## Step 3: Add logs before fixing

Always add logs first, deploy, reproduce, then read:

Backend:
console.log('[handler-name] received:', JSON.stringify(body))
console.log('[handler-name] user:', user?.id, user?.name)
console.log('[handler-name] result:', result)

Frontend:
console.log('[screen-name] function called, state:', { name, birthDate })
console.log('[screen-name] about to send request')
console.log('[screen-name] response:', data)

## Step 4: Fix the root cause

Fix the smallest possible thing.
Do not refactor surrounding code while fixing a bug.
Show the file before changing it.
Show the diff after changing it.

## Step 5: Verify

cd astro-coach-api && npx tsc --noEmit
Zero TypeScript errors required before committing.

Then test the exact scenario that was broken.
Report the result before committing.

## Known production failure patterns

| Symptom                          | Root cause                              | Fix                                    |
|----------------------------------|-----------------------------------------|----------------------------------------|
| Route returns 404                | Registered after wildcard in app.ts     | Move route before wildcard             |
| "complete your profile" error    | Missing include: { birthProfile: true } | Add include to Prisma query            |
| Name reverts after refresh       | auth/sync overwrites user.name          | Remove name from sync update payload   |
| Save shows success but no change | PUT never fires (validation blocks)     | Remove required birthDate check        |
| Transit list empty               | birthLat/birthLong null, engine skipped | Geocode city, remove strict null check |
| Persian chat broken              | Language instruction too weak           | Make LLM instruction explicit/forceful |
| sweph crash → 500                | Data files absent on Railway            | Wrap ALL sweph in try/catch            |
| TypeScript build fails           | Wrong field name (firstName vs name)    | Use ai/FIELD_NAMES.md                  |
