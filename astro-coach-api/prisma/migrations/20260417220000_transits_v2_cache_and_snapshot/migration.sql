-- Transits V2: UserTransitDailyCache + optional banner / moon fields on TransitSnapshot

-- AlterTable
ALTER TABLE "TransitSnapshot" ADD COLUMN "dominantEventId" TEXT;
ALTER TABLE "TransitSnapshot" ADD COLUMN "bannerTitleEn" TEXT;
ALTER TABLE "TransitSnapshot" ADD COLUMN "bannerTitleFa" TEXT;
ALTER TABLE "TransitSnapshot" ADD COLUMN "bannerBodyEn" TEXT;
ALTER TABLE "TransitSnapshot" ADD COLUMN "bannerBodyFa" TEXT;
ALTER TABLE "TransitSnapshot" ADD COLUMN "moonContextJson" JSONB;
ALTER TABLE "TransitSnapshot" ADD COLUMN "lifecycleVersion" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "UserTransitDailyCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "dominantEventId" TEXT,
    "eventsJson" JSONB NOT NULL,
    "ingressesJson" JSONB,
    "lunationsJson" JSONB,
    "retrogradesJson" JSONB,
    "moonContextJson" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTransitDailyCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTransitDailyCache_userId_localDate_language_key" ON "UserTransitDailyCache"("userId", "localDate", "language");

-- CreateIndex
CREATE INDEX "UserTransitDailyCache_userId_expiresAt_idx" ON "UserTransitDailyCache"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "UserTransitDailyCache" ADD CONSTRAINT "UserTransitDailyCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
