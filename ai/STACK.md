# Akhtar — confirmed stack

## Monorepo structure

astro/
├── astro-coach-api/     → backend (api.akhtar.today)
├── astro-coach-app/     → PWA (app.akhtar.today)
└── akhtar-landing/      → marketing (akhtar.today)

## Frontend

Framework:        React Native + Expo SDK 55
Language:         TypeScript strict mode
Navigation:       Expo Router v3 (file-based, app/ directory)
Styling:          NativeWind v4 (Tailwind) — no inline StyleSheet unless unavoidable
Icons:            @expo/vector-icons (Ionicons)
Animations:       react-native-reanimated
Safe area:        SafeAreaView from react-native-safe-area-context (not react-native)
Storage:          AsyncStorage or SecureStore — check existing usage before adding

## Backend

Framework:        Hono (TypeScript) on Railway
ORM:              Prisma with PostgreSQL on Railway
Auth:             Firebase Admin SDK (verifies tokens server-side)
                  Middleware: firebaseAuthMiddleware
                  User lookup: prisma.user.findUnique({ where: { firebaseUid } })

## Auth (client)

Provider:         Firebase Authentication
Sign-in:          Google Sign-In
Token:            getIdToken() — pass as Bearer token to backend
Universal ID:     Firebase UID links PostgreSQL, RevenueCat, Firestore
NEVER suggest:    Clerk (was removed), Supabase, Auth0

## LLM

Gateway:          OpenRouter (OPENROUTER_API_KEY in Railway)
Primary model:    google/gemini-3-flash-preview via google-ai-studio
Fallback model:   moonshotai/kimi-k2.5 via chutes/int4
Entry point:      generateCompletion() in src/services/ai/generateCompletion.ts
Rule:             NEVER hardcode model names. NEVER call LLM APIs directly.
Rule:             NEVER suggest gpt-4o, Claude, or any other model as default.
Both models support multimodal (images).

## Astrology engine

Library:          sweph (Swiss Ephemeris Node.js bindings)
CRITICAL:         sweph data files are NOT present on Railway production.
Rule:             ALL sweph calls must be wrapped in try/catch with graceful fallback.
                  Never let sweph failure cause a 500 error.

## Subscriptions

Native (iOS/Android): RevenueCat
Web:                  Stripe
Stripe price ID:      price_... format (in Railway env vars)
Stripe webhook:       registered BEFORE Firebase auth middleware in app.ts

## Deployment

Backend:     Railway (auto-deploys from GitHub main branch)
Frontend:    Expo (PWA via EAS Build or expo export)
DNS:         Cloudflare
Domain:      akhtar.today (name.com registrar)
Version ctrl: GitHub Desktop only — never git CLI

## Environment variables (Railway)

ANTHROPIC_API_KEY       (legacy, may still exist)
OPENROUTER_API_KEY
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
STRIPE_SECRET_KEY
STRIPE_PRICE_ID
STRIPE_WEBHOOK_SECRET
DATABASE_URL
CRON_SECRET
NODE_VERSION=20
