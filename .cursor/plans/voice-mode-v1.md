# Voice Mode v1 — Implementation plan (final)

Single source of truth for Voice Mode v1. Incorporates codebase audit + **Cursor Prompt 1 of 2** (backend) + **Cursor Prompt 2 of 2** (frontend).

---

## Audit takeaways (implementation constraints)

1. **`sendMessage` is currently `(content: string) => Promise<void>`** — widen to **`(content: string, voiceMeta?: VoiceMeta) => Promise<void>`** and merge `voiceMeta` (or default `{ inputMode: "text" }`) into both web and native POST bodies in [`useStreamingChat.ts`](astro-coach-app/lib/useStreamingChat.ts).

2. **`ChatComposerBar` has no mic slot** — add **`leadingAccessory?: React.ReactNode`** and render it **before** `TextInput` (import `ReactNode` from `"react"`).

3. **No `streamingText` in the hook** — parents derive live assistant text as **`messages.findLast((m) => m.role === "assistant")?.content`** (or equivalent) **while `isStreaming`**; pass to `VoiceInputBar` as `streamingText`.

4. **OpenRouter path** — [`openrouterCompletion.ts`](astro-coach-api/src/services/ai/openrouterCompletion.ts) uses the **OpenAI SDK** `client.chat.completions.create` with **`image_url` + data URLs** for vision. **Audio transcription** should use the **same client**, with an **`input_audio`** (or OpenRouter-documented) content part — see [`voiceTranscription.ts`](#b3--create-voicetranscriptionts) below.

5. **`SafetyCheckInput`** — only relevant if calling [`generateCompletion`](astro-coach-api/src/services/ai/generateCompletion.ts). The **final design uses a standalone `transcribeAudio` helper** (no `generateCompletion`), so safety is **not** applied inside transcription unless you add a separate check; **`voice.ts`** uses Zod + `transcribeAudio` only.

---

## Pre-read (workspace rules)

Before multi-file edits, read:

1. [`ai/STACK.md`](ai/STACK.md)  
2. [`ai/ARCHITECTURE.md`](ai/ARCHITECTURE.md)  
3. [`ai/FIELD_NAMES.md`](ai/FIELD_NAMES.md)  

Commits: **GitHub Desktop only** (no git CLI).

---

# Part A — Backend (Prompt 1)

## A.0 — Read before starting

1. `ai/STACK.md`, `ai/ARCHITECTURE.md`, `ai/FIELD_NAMES.md`  
2. [`astro-coach-api/prisma/schema.prisma`](astro-coach-api/prisma/schema.prisma)  
3. [`astro-coach-api/src/services/ai/openrouterCompletion.ts`](astro-coach-api/src/services/ai/openrouterCompletion.ts)  
4. [`astro-coach-api/src/app.ts`](astro-coach-api/src/app.ts) — lines 1042–1245, 1248–1467, 3335–3543 (and **3545–3700** if extending compatibility/message)  

Show what was read, then implement.

## A.1 — DB migration

Add to **`Message`**: `inputMode String?`, `transcript String? @db.Text`, `language String?` (comments: text/voice, fa/en).

Add the **same three** fields to **`ChatMessage`**.

```bash
cd astro-coach-api && npx prisma migrate dev --name add_voice_fields_to_message
```

## A.2 — `voiceTranscription.ts`

Create [`astro-coach-api/src/services/ai/voiceTranscription.ts`](astro-coach-api/src/services/ai/voiceTranscription.ts) per your spec: **`transcribeAudio`**, OpenRouter client, `input_audio` block, allowlist MIME types, `OR_PRIMARY_MODEL`.

**Implementation note:** [`openrouterCompletion.ts`](astro-coach-api/src/services/ai/openrouterCompletion.ts) currently **`export`s** only functions — **`OR_PRIMARY_MODEL` is not exported**. Either:

- **Export** `getOpenRouterClient` (already in `../../lib/openrouterClient.js`) and **`OR_PRIMARY_MODEL`** from `openrouterCompletion.ts` (or from a tiny shared `openrouterModels.ts`), **or**  
- **Duplicate** the model constant in `voiceTranscription.ts` (keep in sync manually).

Prefer **export** to avoid drift.

**Implementation note:** `isAllowedMimeType` in the snippet should match real client `mimeType` strings (e.g. full `audio/webm;codecs=...`). Tighten logic if needed after testing.

**Implementation note:** `as any` on `chat.completions.create` is acceptable only if the OpenAI types lack `input_audio`; verify against OpenRouter docs for Gemini Flash audio.

## A.3 — `routes/voice.ts`

Create [`astro-coach-api/src/routes/voice.ts`](astro-coach-api/src/routes/voice.ts): `requireFirebaseAuth`, Zod body, call:

```ts
await transcribeAudio({
  audioBase64: parsed.data.audioBase64,
  mimeType: parsed.data.mimeType,
  language: parsed.data.language,
});
```

(Return transcript JSON or error status from `TranscriptionResult`.)

## A.4 — Register route

In [`app.ts`](astro-coach-api/src/app.ts): `import { voice } from "./routes/voice.js";` and `api.route("/voice", voice);` with other explicit `api` routes (after `requireFirebaseAuth` middleware on `api`).

## A.5 — Chat handlers — persist voice metadata

### 5a `POST /chat/stream`

- Extend Zod with `inputMode`, `transcript`, `language` (as in your prompt).  
- Capture `inputMode`, `voiceTranscript`, `messageLang`.  
- User `prisma.message.create`: `inputMode`, `transcript`, `language`.  
- Assistant creates (unsafe + success): `inputMode: "text"`, `language: messageLang` (and `transcript` omitted/null).

### 5b `POST /chat/message`

Same pattern (`payload` instead of `raw`).

### 5c `POST /people/compatibility/chat`

Same pattern.

### 5d (recommended) `POST /people/compatibility/message`

Mirror **5c** so native-only compatibility keeps parity (Zod + 2 assistant paths + 1 user path).

**Save points:** Your prompt counts **6** creates across **3** handlers; adding **compatibility/message** adds **3** more creates (user + 2 assistant paths).

## A.6 — Verify (backend)

- `cd astro-coach-api && npx tsc --noEmit`  
- Migration folder present  
- Voice route live at **`POST /api/voice/transcribe`**

---

# Part B — Frontend (Prompt 2)

## B.0 — Read before starting

1. [`useStreamingChat.ts`](astro-coach-app/lib/useStreamingChat.ts) — full  
2. [`ChatComposerBar.tsx`](astro-coach-app/components/chat/ChatComposerBar.tsx) — full  
3. [`ask-me-anything.tsx`](astro-coach-app/app/(main)/ask-me-anything.tsx) — full  
4. [`feature/[id].tsx`](astro-coach-app/app/(main)/feature/[id].tsx) — full  
5. Top-level keys in `locales/en.json` and `fa.json`  

## B.1 — Packages

```bash
npx expo install expo-av
npx expo install expo-speech
npx expo install expo-file-system
```

## B.2 — `types/speech.d.ts`

Create as specified; ensure [`tsconfig.json`](astro-coach-app/tsconfig.json) **includes** `types/**/*.d.ts` (or equivalent).

## B.3 — `useStreamingChat.ts`

- Add **`VoiceMeta`** type (`inputMode: "voice"`, optional `transcript`, `language`).  
- **`sendMessage: (content: string, voiceMeta?: VoiceMeta) => Promise<void>`**  
- Merge body:

```ts
JSON.stringify({
  content: text,
  ...(getExtraBody?.() ?? {}),
  ...(voiceMeta ?? { inputMode: "text" }),
});
```

Apply to **both** web `fetch` and native `apiRequest` branches (same shape).

**Scope:** Keep other hook behavior unchanged.

## B.4 — `ChatComposerBar.tsx`

- Add **`leadingAccessory?: React.ReactNode`** to props.  
- Render `{leadingAccessory ?? null}` **immediately before** `TextInput`.

## B.5 — New files

- [`lib/useVoiceMode.ts`](astro-coach-app/lib/useVoiceMode.ts) — per your Phase 5 (cancel vs transcribe split, `mountedRef`, `voiceStateRef`).  
- [`components/voice/VoiceOrb.tsx`](astro-coach-app/components/voice/VoiceOrb.tsx) — per Phase 6 (`PARTICLE_POSITIONS` stable; remove unused `useMemo` if not used).  
- [`components/voice/VoiceInputBar.tsx`](astro-coach-app/components/voice/VoiceInputBar.tsx) — per Phase 7.

## B.6 — i18n

Add top-level **`voice`** objects to [`en.json`](astro-coach-app/locales/en.json) and [`fa.json`](astro-coach-app/locales/fa.json) per Phase 8.

## B.7 — `ask-me-anything.tsx`

- `useVoiceMode` + **`prevIsStreamingRef`** speak effect (only on **true → false** `isStreaming` transition).  
- **`streamingText`**: `isStreaming ? (messages.findLast(m => m.role === "assistant")?.content ?? "") : undefined` — verify **`findLast`** is available (TypeScript **`lib`** ES2023 / `target`); if not, use a small loop or `[...messages].reverse().find(...)`.  
- **`leadingAccessory`**: mic `Pressable` toggling voice mode.  
- Conditional **`VoiceInputBar`** vs existing **`ChatComposerBar`**.

## B.8 — `feature/[id].tsx`

- **DreamInterpreterFeature** — voice on follow-up composer; initial dream textarea: product choice (voice vs text-only for first submit).  
- **CoffeeReadingFeature** — mic / voice UI only **after** initial reading is complete (e.g. `data` set and not in loading/upload-only phase).  
- **CompatibilityFeature** — same AMA pattern; ensure **`getExtraBody`** passes `sessionId` / `personProfileId` **and** voice fields when sending.

## B.9 — Verify (frontend + cross-cutting)

- `npx tsc --noEmit` in **both** packages  
- Packages present  
- New files present  
- Mic only additive; core chat unchanged when voice off  

---

## Optional follow-ups (out of scope unless requested)

- Persist voice fields on **dream interpret** POST if voice is used for initial dream text.  
- Server-side safety on transcription text (regex) before returning transcript.
