/**
 * INSERT-only seed for mantra v2 templates. Does not modify existing rows.
 * Run: npx tsx prisma/seedMantraV2.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QUALITIES = [
  "patience",
  "boundaries",
  "rebuilding",
  "discipline",
  "clarity",
  "courage",
  "letting-go",
  "softness",
  "expansion",
  "groundedness",
  "worth",
  "connection",
] as const;

const PATIENCE_REAL = [
  {
    primaryQuality: "patience",
    secondaryQualities: ["groundedness"],
    mantraEnDirect: "I can take one steady step today.",
    mantraEnExploratory: "What if one steady step is actually enough?",
    mantraFaDirect: "می‌توانم امروز یک قدم آرام بردارم.",
    mantraFaExploratory: "TODO — needs native Persian writer review",
    isActive: true,
    faReviewStatus: "pending",
  },
  {
    primaryQuality: "patience",
    secondaryQualities: ["discipline"],
    mantraEnDirect: "I don't have to rush this.",
    mantraEnExploratory: "I'm allowed to not rush this.",
    mantraFaDirect: "لازم نیست عجله کنم.",
    mantraFaExploratory: "TODO — needs native Persian writer review",
    isActive: true,
    faReviewStatus: "pending",
  },
  {
    primaryQuality: "patience",
    secondaryQualities: [],
    mantraEnDirect: "I am building something slowly and it counts.",
    mantraEnExploratory: "I'm learning that building slowly still counts.",
    mantraFaDirect: "دارم چیزی را آرام می‌سازم و اهمیت دارد.",
    mantraFaExploratory: "TODO — needs native Persian writer review",
    isActive: true,
    faReviewStatus: "pending",
  },
  {
    primaryQuality: "patience",
    secondaryQualities: ["softness"],
    mantraEnDirect: "I can be tired and still be enough.",
    mantraEnExploratory: "It's okay to be tired and still be enough.",
    mantraFaDirect: "می‌توانم خسته باشم و کافی باشم.",
    mantraFaExploratory: "TODO — needs native Persian writer review",
    isActive: true,
    faReviewStatus: "pending",
  },
  {
    primaryQuality: "patience",
    secondaryQualities: [],
    mantraEnDirect: "I choose steadiness over speed today.",
    mantraEnExploratory: "I am learning to choose steadiness over speed.",
    mantraFaDirect: "امروز ثبات را بر سرعت ترجیح می‌دهم.",
    mantraFaExploratory: "TODO — needs native Persian writer review",
    isActive: true,
    faReviewStatus: "pending",
  },
];

function stubRow(primary: string, idx: number) {
  return {
    primaryQuality: primary,
    secondaryQualities: [] as string[],
    mantraEnDirect: "TODO",
    mantraEnExploratory: "TODO",
    mantraFaDirect: "TODO",
    mantraFaExploratory: "TODO",
    isActive: false,
    faReviewStatus: "pending",
    planetTag: "any",
    aspectTag: "any",
    signTag: "any",
    qualityTag: primary,
    mantraEn: "TODO",
    mantraFa: "TODO",
    themeAffinity: [] as string[],
  };
}

async function main() {
  const toCreate: Parameters<typeof prisma.mantraTemplate.createMany>[0]["data"] = [];

  for (const row of PATIENCE_REAL) {
    toCreate.push({
      ...row,
      planetTag: "any",
      aspectTag: "any",
      signTag: "any",
      qualityTag: row.primaryQuality,
      mantraEn: row.mantraEnDirect,
      mantraFa: row.mantraFaDirect,
      themeAffinity: row.secondaryQualities,
    });
  }

  for (let i = 6; i <= 15; i++) {
    toCreate.push(stubRow("patience", i));
  }

  for (const q of QUALITIES) {
    if (q === "patience") continue;
    for (let n = 0; n < 15; n++) {
      toCreate.push(stubRow(q, n));
    }
  }

  await prisma.mantraTemplate.createMany({ data: toCreate });
  console.log("seedMantraV2: inserted", toCreate.length, "rows");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
