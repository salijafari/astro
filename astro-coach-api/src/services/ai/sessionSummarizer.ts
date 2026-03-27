import { prisma } from "../../lib/prisma.js";
import { generateCompletion } from "./generateCompletion.js";
import type { SessionSummaryContext } from "../../types/promptContext.js";

/**
 * JSON shape the LLM is asked to return when summarising a session.
 */
interface SummaryPayload {
  summary: string;
  themes: string[];
  emotionalTone: string;
  openLoops: string[];
}

const SUMMARIZE_SYSTEM_PROMPT = `
You are a session summariser for an AI life coaching app.
Given a list of chat messages from one session, produce a concise, structured summary.

Return ONLY valid JSON with no markdown fences, no preamble:
{
  "summary": "2–4 sentence plain English summary of what was discussed and any conclusions reached",
  "themes": ["array of 2–5 topic tags, e.g. career, self-worth, relationships"],
  "emotionalTone": "1–2 words describing the overall emotional tone, e.g. reflective, anxious, hopeful",
  "openLoops": ["array of 0–4 unresolved questions or topics that deserve follow-up in the next session"]
}

Rules:
- Be concise — this summary will be injected into future prompts so brevity matters.
- summary: plain English, no astrological jargon unless the user raised it.
- themes: use consistent lowercase slug-style tags.
- openLoops: only include genuine unresolved threads — do not fabricate them.
- Do NOT include personally identifying information like full names, dates, or locations.
`.trim();

/**
 * Summarises a completed chat session and persists the summary to the database.
 *
 * - Fetches the session's messages from the database.
 * - Calls the LLM to produce a structured JSON summary.
 * - Upserts the result into the ChatSessionSummary table.
 *
 * Safe to call multiple times — upserts on sessionId so it won't create duplicates.
 */
export async function summarizeSession(sessionId: string): Promise<void> {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      },
    },
  });

  if (!session) {
    console.warn(`[sessionSummarizer] Session not found: ${sessionId}`);
    return;
  }

  if (session.messages.length < 4) {
    // Too short to be worth summarising
    return;
  }

  // Build a compact transcript for the LLM
  const transcript = session.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 400)}`)
    .join("\n");

  const result = await generateCompletion({
    feature: "session_summarizer",
    complexity: "lightweight",
    messages: [
      { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
      { role: "user", content: `Summarise this session:\n\n${transcript}` },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: 400,
    temperature: 0.3,
  });

  if (!result.ok || result.kind !== "success") {
    console.error(`[sessionSummarizer] LLM failed for session ${sessionId}:`, result);
    return;
  }

  let payload: SummaryPayload;
  try {
    payload = JSON.parse(result.content) as SummaryPayload;
  } catch {
    console.error(`[sessionSummarizer] JSON parse failed for session ${sessionId}:`, result.content);
    return;
  }

  await prisma.chatSessionSummary.upsert({
    where: { sessionId },
    update: {
      summary: payload.summary,
      themes: payload.themes,
      emotionalTone: payload.emotionalTone,
      openLoops: payload.openLoops,
    },
    create: {
      sessionId,
      userId: session.userId,
      summary: payload.summary,
      themes: payload.themes,
      emotionalTone: payload.emotionalTone,
      openLoops: payload.openLoops,
    },
  });

  console.log(JSON.stringify({
    event: "session.summarized",
    sessionId,
    userId: session.userId,
    themes: payload.themes,
  }));
}

/**
 * Fetches the most recent session summary for a user as a lightweight
 * SessionSummaryContext ready for injection into PromptContext.
 *
 * Returns null if no summary exists yet.
 */
export async function getLatestSessionSummary(
  userId: string
): Promise<SessionSummaryContext | null> {
  const row = await prisma.chatSessionSummary.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      summary: true,
      themes: true,
      emotionalTone: true,
      openLoops: true,
      createdAt: true,
    },
  });

  if (!row) return null;

  return {
    summary: row.summary,
    themes: row.themes as string[],
    emotionalTone: row.emotionalTone,
    openLoops: row.openLoops as string[],
    sessionDate: row.createdAt.toISOString().slice(0, 10),
  };
}
