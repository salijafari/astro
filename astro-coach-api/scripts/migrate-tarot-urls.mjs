/**
 * Migrates tarot-cards.json imageUrl to WebP full paths and adds thumbnailUrl.
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, "../src/data/tarot-cards.json");

const FULL_BASE = "https://storage.googleapis.com/akhtar-assets/tarot/cards/full";
const THUMB_BASE = "https://storage.googleapis.com/akhtar-assets/tarot/cards/thumb";

const raw = readFileSync(jsonPath, "utf8");
const cards = JSON.parse(raw);

let updated = 0;
for (const card of cards) {
  const url = new URL(card.imageUrl);
  const lastSegment = url.pathname.split("/").pop() ?? "";
  const basename = lastSegment.replace(/\.[^.]+$/, "");
  if (!basename) {
    throw new Error(`Could not parse basename from imageUrl: ${card.imageUrl}`);
  }
  card.imageUrl = `${FULL_BASE}/${basename}.webp`;
  card.thumbnailUrl = `${THUMB_BASE}/${basename}.webp`;
  updated++;
}

writeFileSync(jsonPath, `${JSON.stringify(cards, null, 2)}\n`, "utf8");

console.log(`Updated ${updated} tarot card entries.`);
console.log("First 3 entries after migration:");
console.log(JSON.stringify(cards.slice(0, 3), null, 2));
