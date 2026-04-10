-- Clean reset: no production data to preserve (TarotReading v2 schema).

DROP TABLE IF EXISTS "TarotReading";

CREATE TABLE "TarotReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spreadId" TEXT NOT NULL,
    "question" TEXT,
    "drawnCards" JSONB NOT NULL,
    "interpretation" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TarotReading_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TarotReading_userId_createdAt_idx" ON "TarotReading"("userId", "createdAt" DESC);

ALTER TABLE "TarotReading" ADD CONSTRAINT "TarotReading_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
