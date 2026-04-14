import { PrismaClient } from "@prisma/client";
import { mantraTemplates } from "./mantraTemplates.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding mantra templates...");
  for (const template of mantraTemplates) {
    const { id, ...fields } = template;
    await prisma.mantraTemplate.upsert({
      where: { id },
      update: fields,
      create: { id, ...fields },
    });
  }
  console.log(`Seeded ${mantraTemplates.length} templates.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
