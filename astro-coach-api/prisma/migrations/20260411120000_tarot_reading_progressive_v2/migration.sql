-- Progressive tarot: replace TarotReading shape (spreadId/drawnCards/interpretation → allCards/depths).
-- Drops existing rows — acceptable for this migration per product decision.

DROP TABLE IF EXISTS "TarotReading";

CREATE TABLE "TarotReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT,
    "allCards" JSONB NOT NULL,
    "currentDepth" TEXT NOT NULL DEFAULT 'single',
    "interpretations" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarotReading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TarotReading_userId_createdAt_idx" ON "TarotReading"("userId", "createdAt" DESC);

ALTER TABLE "TarotReading" ADD CONSTRAINT "TarotReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
