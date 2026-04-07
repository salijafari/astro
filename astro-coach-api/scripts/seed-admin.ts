import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.adminUser.upsert({
    where: { email: "publishvibe@gmail.com" },
    update: {},
    create: {
      email: "publishvibe@gmail.com",
      addedBy: "system",
    },
  });
  console.log("Admin seeded:", result.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
