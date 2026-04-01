# Akhtar — confirmed field names

This file exists because field name mismatches have caused multiple production
bugs. Use these names exactly. Do not assume. Do not invent alternatives.

## User model (PostgreSQL via Prisma)

| Field                | Correct name         | Common wrong versions        |
|----------------------|----------------------|------------------------------|
| User's name          | name                 | firstName, displayName       |
| Onboarding flag      | onboardingComplete   | onboardingCompleted (no 'd') |
| Firebase identifier  | firebaseUid          | uid, userId, firebaseId      |
| Language preference  | language             | lang, locale                 |
| Subscription status  | subscriptionStatus   | status, subStatus            |
| Trial start          | trialStartedAt       | trialStart, trialDate        |
| Stripe customer      | stripeCustomerId     | stripeId, customerId         |

## BirthProfile model (PostgreSQL via Prisma)

| Field                | Correct name         | Notes                        |
|----------------------|----------------------|------------------------------|
| Date of birth        | birthDate            | DateTime                     |
| Time of birth        | birthTime            | String or null               |
| City label           | birthCity            | String or null               |
| Latitude             | birthLat             | Float or null                |
| Longitude            | birthLong            | Float or null (NOT birthLng) |
| Timezone             | birthTimezone        | IANA string or null          |
| Sun sign             | sunSign              | String or null               |
| Moon sign            | moonSign             | String or null               |
| Rising sign          | risingSign           | String or null               |
| Full chart JSON      | natalChartJson       | Json or null                 |
| Interest tags        | interestTags         | String array                 |

## Critical Prisma query rule

Any query that accesses birthProfile fields MUST include:
include: { birthProfile: true }

Without this, birthProfile is undefined at runtime even if data exists.
This is the single most common source of "complete your profile" errors.

Example:
const user = await prisma.user.findUnique({
  where: { firebaseUid: firebaseUser.uid },
  include: { birthProfile: true }   // REQUIRED
})

## API response mapping

The GET /api/user/profile endpoint maps database fields like this:
- firstName in the response = user.name from database (alias for frontend compat)
- NEVER map firstName from Firebase token, email, or any other source

## Language values

'fa' = Persian/Farsi (default when null)
'en' = English

Language instruction to LLM must be explicit and forceful:
CORRECT: "CRITICAL: You MUST respond ONLY in Persian (Farsi). Every word must be in Persian."
WRONG:   "Please respond in Persian if possible."

## Onboarding completion

Field:  onboardingComplete (boolean, no trailing 'd')
Set to: true when onboarding finishes
Rule:   NEVER clear this field after it has been set to true
Rule:   NEVER route to onboarding after this is true
