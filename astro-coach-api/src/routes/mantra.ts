import type { DecodedIdToken } from "firebase-admin/auth";
import { Hono } from "hono";
import { z } from "zod";
import { hasFeatureAccess } from "../lib/revenuecat.js";
import { requireFirebaseAuth } from "../middleware/firebase-auth.js";
import {
  deleteSavedMantra,
  getSavedMantras,
  getOrCreateMantraCache,
  MantraServiceError,
  pinMantra,
  refreshMantra,
  saveMantraBookmark,
  saveMantraToJournal,
  unpinMantra,
} from "../services/mantraService.js";

type Vars = { firebaseUid: string; firebaseUser: DecodedIdToken; dbUserId: string };

const mantra = new Hono<{ Variables: Vars }>();
mantra.use("*", requireFirebaseAuth);

mantra.get("/mantra/today", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const firebaseUid = c.get("firebaseUid");
    const theme = c.req.query("theme")?.trim() || undefined;
    const data = await getOrCreateMantraCache(dbUserId, firebaseUid, theme ?? null);
    const isPremium = await hasFeatureAccess(firebaseUid, dbUserId);
    return c.json({ ...data, isPremium });
  } catch (e: unknown) {
    console.error("[mantra/today]", e);
    if (e instanceof MantraServiceError) {
      return c.json(
        { error: e.message, upgradeRequired: e.upgradeRequired },
        e.status as 400 | 403 | 404 | 500,
      );
    }
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});

mantra.post("/mantra/refresh", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const firebaseUid = c.get("firebaseUid");
    const body = z.object({ theme: z.string().optional() }).parse(await c.req.json().catch(() => ({})));
    const isPremium = await hasFeatureAccess(firebaseUid, dbUserId);
    const data = await refreshMantra(dbUserId, firebaseUid, isPremium, body.theme ?? null);
    return c.json({ ...data, isPremium });
  } catch (e: unknown) {
    console.error("[mantra/refresh]", e);
    if (e instanceof MantraServiceError) {
      return c.json(
        { error: e.message, upgradeRequired: e.upgradeRequired },
        e.status as 400 | 403 | 404 | 500,
      );
    }
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});

mantra.post("/mantra/pin", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const firebaseUid = c.get("firebaseUid");
    const isPremium = await hasFeatureAccess(firebaseUid, dbUserId);
    const result = await pinMantra(dbUserId, isPremium);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/pin]", e);
    if (e instanceof MantraServiceError) {
      return c.json(
        { error: e.message, upgradeRequired: e.upgradeRequired },
        e.status as 400 | 403 | 404 | 500,
      );
    }
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});

mantra.delete("/mantra/pin", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const result = await unpinMantra(dbUserId);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/pin delete]", e);
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});

mantra.post("/mantra/journal", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const body = z
      .object({
        practiceMode: z.string(),
        repetitionCount: z.number().int().min(0),
        userNote: z.string().optional(),
      })
      .parse(await c.req.json());
    const result = await saveMantraToJournal(dbUserId, body.practiceMode, body.repetitionCount, body.userNote);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/journal]", e);
    if (e instanceof MantraServiceError) {
      return c.json({ error: e.message }, e.status as 400 | 404 | 500);
    }
    return c.json({ error: "Something went wrong. Please try again." }, 500);
  }
});

// Save current mantra as bookmark
mantra.post("/mantra/save", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const result = await saveMantraBookmark(dbUserId);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/save]", e);
    if (e instanceof MantraServiceError) {
      return c.json({ error: e.message }, e.status as 400 | 404 | 500);
    }
    return c.json({ error: "Something went wrong." }, 500);
  }
});

// Get all saved mantras for this user
mantra.get("/mantra/saves", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const result = await getSavedMantras(dbUserId);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/saves]", e);
    return c.json({ error: "Something went wrong." }, 500);
  }
});

// Delete a saved mantra
mantra.delete("/mantra/saves/:saveId", async (c) => {
  try {
    const dbUserId = c.get("dbUserId");
    const saveId = c.req.param("saveId");
    const result = await deleteSavedMantra(dbUserId, saveId);
    return c.json(result);
  } catch (e: unknown) {
    console.error("[mantra/saves delete]", e);
    return c.json({ error: "Something went wrong." }, 500);
  }
});

export default mantra;
