import { Hono } from "hono";
import { z } from "zod";
import type { FirebaseAuthContext } from "../middleware/firebase-auth.js";
import { transcribeAudio } from "../services/ai/voiceTranscription.js";

const voice = new Hono<FirebaseAuthContext>();

/**
 * Mounted at `api.route("/voice", voice)` after `api.use("*", requireFirebaseAuth)`.
 * Full path: POST /api/voice/transcribe
 *
 * Body: { audioBase64: string, mimeType: string, language?: "fa" | "en" }
 * Response: { transcript: string }
 */
voice.post("/transcribe", async (c) => {
  const bodySchema = z.object({
    audioBase64: z.string().min(1),
    mimeType: z.string().min(1),
    language: z.enum(["fa", "en"]).default("fa"),
  });

  const parsed = bodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
  }

  const result = await transcribeAudio({
    audioBase64: parsed.data.audioBase64,
    mimeType: parsed.data.mimeType,
    language: parsed.data.language,
  });

  if (!result.ok) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json({ transcript: result.transcript });
});

export { voice };
