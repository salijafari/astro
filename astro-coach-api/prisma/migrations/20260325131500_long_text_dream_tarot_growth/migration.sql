-- Long user-facing text: keep PostgreSQL TEXT and Prisma @db.Text in sync
ALTER TABLE "DreamEntry" ALTER COLUMN "dreamText" SET DATA TYPE TEXT;
ALTER TABLE "TarotReading" ALTER COLUMN "intention" SET DATA TYPE TEXT;
ALTER TABLE "TarotReading" ALTER COLUMN "summary" SET DATA TYPE TEXT;
ALTER TABLE "GrowthTimelineEntry" ALTER COLUMN "summary" SET DATA TYPE TEXT;
