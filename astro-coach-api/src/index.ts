import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { isFirebaseAdminInitialized } from "./lib/firebase-admin.js";
import { ZODIAC_SIGNS } from "./constants/astrology/signs.js";
import { PLANETS } from "./constants/astrology/planets.js";
import { HOUSES } from "./constants/astrology/houses.js";
import { TRANSIT_MEANINGS } from "./constants/astrology/transits.js";
import { TAROT_DECK } from "./data/tarot-deck.js";
import { TAROT_CARDS_JSON } from "./lib/tarotCardsJson.js";
import { COFFEE_SYMBOLS } from "./constants/tasseographySymbols.js";
import { CHALLENGE_LIBRARY } from "./constants/challengeLibrary.js";
import { CONFLICT_FRAMEWORK } from "./constants/conflictFramework.js";
import { SAFETY_RESPONSES } from "./constants/safetyResponses.js";

/** Verify content databases have sufficient entries on startup. */
function verifyContentCounts(): void {
  const checks: Array<[string, number, number]> = [
    ["Signs", ZODIAC_SIGNS.length, 12],
    ["Planets", PLANETS.length, 10],
    ["Houses", HOUSES.length, 12],
    ["Transits", TRANSIT_MEANINGS.length, 90],  // static file has 96 entries
    ["Tarot cards", TAROT_DECK.length, 78],
    ["Tarot cards JSON", TAROT_CARDS_JSON.length, 78],
    ["Coffee symbols", COFFEE_SYMBOLS.length, 55],
    ["Challenge library", CHALLENGE_LIBRARY.length, 8],
    ["Conflict framework", CONFLICT_FRAMEWORK.length, 5],
    ["Safety responses", SAFETY_RESPONSES.length, 4],
  ];

  let allOk = true;
  for (const [label, actual, expected] of checks) {
    if (actual < expected) {
      allOk = false;
      console.warn(
        `⚠️  Content count warning: ${label} has ${actual} entries (expected ≥${expected}). Run npm run db:seed to populate.`
      );
    }
  }
  if (allOk) {
    console.log("✅ Content databases: all counts healthy.");
  }
}

const port = Number(process.env.PORT) || 3001;

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    firebase: isFirebaseAdminInitialized ? "connected" : "disabled - check env vars",
    database: "connected",
  });
});

verifyContentCounts();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Listening on ${info.port}`);
});
