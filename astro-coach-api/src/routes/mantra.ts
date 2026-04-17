import type { DecodedIdToken } from "firebase-admin/auth";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma.js";
import { hasFeatureAccess } from "../lib/revenuecat.js";
import { requireFirebaseAuth } from "../middleware/firebase-auth.js";
import {
  createMantraPractice,
  deleteMantraPractice,
  getOrServeMantra,
  listMantraPracticeJournal,
  mantraEndpointRemovedBody,
  MantraServiceError,
  pinMantraForUser,
  unpinMantra,
  updatePracticeJournalNote,
} from "../services/mantraService.js";

type Vars = { firebaseUid: string; firebaseUser: DecodedIdToken; dbUserId: string };

const mantra = new Hono<{ Variables: Vars }>();
mantra.use("*", requireFirebaseAuth);

const gone = (c: Context) => c.json(mantraEndpointRemovedBody, 410);

function userLocalDateKey(dbUserId: string, explicit?: string | undefined): Promise<string> {
  return (async () => {
    if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
    const user = await prisma.user.findUnique({
      where: { id: dbUserId },
      include: { birthProfile: true },
    });
    const tz = user?.birthProfile?.birthTimezone?.trim() || "UTC";
    return DateTime.now().setZone(tz).toFormat("yyyy-MM-dd");
  })();
}

mantra.get("/mantra/today", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const firebaseUid = c.get("firebaseUid");
    const qDate = c.req.query("localDate")?.trim();
    const localDate = await userLocalDateKey(dbUserId, qDate);
    const isPremium = await hasFeatureAccess(firebaseUid, dbUserId);
    const data = await getOrServeMantra(dbUserId, localDate, isPremium);
    return c.json(data);
  } catch (e: unknown) {
    console.error("[mantra/today]", e);
    if (e instanceof MantraServiceError) {
      return c.json(
        { error: e.message, upgradeRequired: e.upgradeRequired },
        e.status as 400 | 403 | 404 | 500,
      );
    }
    return c.json({ error: "Something went wrong. Please try again.", message: "server_error" }, 500);
  }
});

mantra.post("/mantra/next", (c) => gone(c));
mantra.post("/mantra/refresh", (c) => gone(c));
mantra.post("/mantra/save", (c) => gone(c));
mantra.get("/mantra/saves", (c) => gone(c));
mantra.delete("/mantra/saves/:saveId", (c) => gone(c));

const practiceBody = z.object({
  templateId: z.string().min(1),
  mantraText: z.string().min(1),
  language: z.enum(["en", "fa"]),
  register: z.enum(["direct", "exploratory"]),
  practiceMode: z.enum([
    "tap3",
    "tap10",
    "tap21",
    "tap108",
    "breath10",
    "timer",
    "silent",
  ]),
  durationSec: z.number().int(),
  journalNote: z.string().max(2000).optional(),
  qualityTag: z.string().min(1),
  qualityLabelEn: z.string(),
  qualityLabelFa: z.string(),
});

mantra.post("/mantra/practice", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const body = practiceBody.parse(await c.req.json());
    if (body.durationSec < 3 || body.durationSec > 3600) {
      return c.json({ error: "invalid_duration", message: "durationSec must be between 3 and 3600." }, 400);
    }
    const result = await createMantraPractice({ userId: dbUserId, ...body });
    return c.json(result, 201);
  } catch (e: unknown) {
    console.error("[mantra/practice]", e);
    if (e instanceof z.ZodError) {
      return c.json({ error: "invalid_body", message: e.message }, 400);
    }
    if (e instanceof MantraServiceError) {
      return c.json({ error: e.message, upgradeRequired: e.upgradeRequired }, e.status as 400 | 403 | 404 | 500);
    }
    return c.json({ error: "Something went wrong." }, 500);
  }
});

mantra.delete("/mantra/practice/:id", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const id = c.req.param("id");
    await deleteMantraPractice(dbUserId, id);
    return c.body(null, 204);
  } catch (e: unknown) {
    console.error("[mantra/practice delete]", e);
    if (e instanceof MantraServiceError) {
      return c.json({ error: e.message }, e.status as 400 | 403 | 404 | 500);
    }
    return c.json({ error: "Something went wrong." }, 500);
  }
});

mantra.patch("/mantra/practice/:id/note", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const id = c.req.param("id");
    const { journalNote } = z
      .object({ journalNote: z.string().max(2000).nullable() })
      .parse(await c.req.json());
    await updatePracticeJournalNote(dbUserId, id, journalNote);
    return c.json({ ok: true });
  } catch (e: unknown) {
    console.error("[mantra/practice note]", e);
    if (e instanceof MantraServiceError) {
      return c.json({ error: e.message }, e.status as 400 | 403 | 404 | 500);
    }
    return c.json({ error: "Something went wrong." }, 500);
  }
});

mantra.get("/mantra/journal", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? "20")));
    const beforeRaw = c.req.query("before");
    const before =
      beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : null;
    const data = await listMantraPracticeJournal({ userId: dbUserId, limit, before });
    return c.json(data);
  } catch (e: unknown) {
    console.error("[mantra/journal]", e);
    return c.json({ error: "Something went wrong." }, 500);
  }
});

mantra.post("/mantra/pin", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const firebaseUid = c.get("firebaseUid");
    const result = await pinMantraForUser(dbUserId, firebaseUid);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/pin]", e);
    if (e instanceof MantraServiceError) {
      return c.json(
        { error: e.message, upgradeRequired: e.upgradeRequired },
        e.status as 400 | 403 | 404 | 500,
      );
    }
    return c.json({ error: "Something went wrong." }, 500);
  }
});

mantra.delete("/mantra/pin", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    await unpinMantra(dbUserId);
    return c.body(null, 204);
  } catch (e: unknown) {
    console.error("[mantra/pin delete]", e);
    return c.json({ error: "Something went wrong." }, 500);
  }
});

export default mantra;
