# Akhtar — architecture boundaries

## Backend: astro-coach-api

Entry point:    src/app.ts (all routes registered here)
AI service:     src/services/ai/generateCompletion.ts
AI prompts:     src/services/ai/systemPrompts.ts
Firebase admin: src/lib/firebase-admin.ts
Stripe client:  src/lib/stripe.ts
Prisma client:  src/lib/prisma.ts

## Route registration rule

Routes in app.ts are matched top to bottom.
A wildcard like app.get('*', ...) will shadow any route below it.

Rule: every new route must be placed BEFORE any wildcard.
Check: grep -n "app\.route\|app\.use\|\.\(\'\*\'\)" astro-coach-api/src/app.ts

This has caused production 404s before. It will cause them again if ignored.

## Frontend: astro-coach-app

Routing:   app/ directory (Expo Router file-based)
Auth:      providers/FirebaseAuthProvider.tsx
Profile:   lib/userProfile.ts (fetch + 5min cache + invalidation)
Features:  lib/featureConfig.ts (dashboard feature definitions)
Screens:   app/(main)/ for feature screens
Settings:  app/(settings)/ for settings screens
Onboarding: app/(onboarding)/ — NEVER touch unless explicitly told

## Single routing authority

app/index.tsx is the ONLY file that decides where to route after auth.
No other file should contain top-level routing logic.
This prevents infinite re-render loops.

## Auth flow (do not break)

1. Firebase sign-in
2. POST /api/auth/sync (creates/updates User in PostgreSQL)
3. app/index.tsx reads profile from API and routes

The sync handler must NEVER overwrite User.name for existing users.
It may only set name for newly created users (when name is null).

## Profile data flow

Source of truth:  PostgreSQL (User + BirthProfile tables)
Never use:        Firebase token display name for User.name
Never use:        Email-derived names
Cache:            fetchUserProfile() caches for 5 minutes
Invalidation:     Call invalidateProfileCache() after any profile update

## LLM architecture

Two-layer rule (never violate):
Layer 1 — Deterministic:  sweph computes astrology data
Layer 2 — Generative:     LLM interprets pre-computed structured data

The LLM NEVER calculates planetary positions, aspects, or chart data.
Astrology calculations happen in sweph (or fallback approximations).
The LLM receives structured JSON and writes human-readable copy.

## Conversation storage

Table: Conversation (id, userId, title, category, createdAt, updatedAt)
Table: Message (id, conversationId, role, content, createdAt)

Category values (use exactly):
- 'ask_me_anything'
- 'dream_interpreter'
- 'coffee_reading'
- 'romantic_compatibility'
- 'transits'
- 'tarot'

Sessions: sessionId = Conversation.id
Context:  last 20 messages loaded per request for LLM context
