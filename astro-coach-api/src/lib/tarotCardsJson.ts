import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { TarotCard } from "../types/tarot.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** All 78 RWS cards from static JSON (copied to dist/data on build). */
export const TAROT_CARDS_JSON: TarotCard[] = JSON.parse(
  readFileSync(join(__dirname, "../data/tarot-cards.json"), "utf8"),
) as TarotCard[];
