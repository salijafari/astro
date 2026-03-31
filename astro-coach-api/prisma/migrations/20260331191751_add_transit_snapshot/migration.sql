-- CreateTable
CREATE TABLE "TransitSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "timeframeScope" TEXT NOT NULL,
    "dailyOutlookTitle" TEXT,
    "dailyOutlookText" TEXT,
    "moodLabel" TEXT,
    "bigThreeJson" JSONB,
    "precisionNote" TEXT,
    "transitsJson" JSONB,
    "sourceChartHash" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransitSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransitSnapshot_userId_localDate_idx" ON "TransitSnapshot"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "TransitSnapshot_userId_localDate_timeframeScope_key" ON "TransitSnapshot"("userId", "localDate", "timeframeScope");

-- AddForeignKey
ALTER TABLE "TransitSnapshot" ADD CONSTRAINT "TransitSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
