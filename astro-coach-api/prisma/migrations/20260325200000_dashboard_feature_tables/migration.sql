-- Create dashboard feature tables (PeopleProfile, Horoscope cache, Compatibility, Chat, Coffee, Growth, Challenges, Events, Future Seer)

CREATE TABLE "PeopleProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "birthTime" TEXT,
  "birthPlace" TEXT,
  "birthLat" DOUBLE PRECISION,
  "birthLng" DOUBLE PRECISION,
  "birthTimezone" TEXT,
  "hasFullData" BOOLEAN NOT NULL DEFAULT false,
  "natalChartJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PeopleProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PeopleProfile"
  ADD CONSTRAINT "PeopleProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PeopleProfile_userId_createdAt_idx" ON "PeopleProfile"("userId", "createdAt");

CREATE TABLE "DailyHoroscope" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "moodLabel" TEXT NOT NULL,
  "affirmation" TEXT,
  "focusArea" TEXT,
  "transitJson" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyHoroscope_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailyHoroscope"
  ADD CONSTRAINT "DailyHoroscope_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DailyHoroscope_userId_date_key" ON "DailyHoroscope"("userId", "date");

CREATE TABLE "CompatibilityReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "personProfileId" TEXT NOT NULL,
  "overallScore" INTEGER NOT NULL,
  "emotionalScore" INTEGER NOT NULL,
  "communicationScore" INTEGER NOT NULL,
  "attractionScore" INTEGER NOT NULL,
  "longTermScore" INTEGER NOT NULL,
  "conflictScore" INTEGER NOT NULL,
  "narrativeSummary" TEXT NOT NULL,
  "tips" JSONB NOT NULL,
  "synastryScoringJson" JSONB NOT NULL,
  "isFullReport" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompatibilityReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompatibilityReport"
  ADD CONSTRAINT "CompatibilityReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompatibilityReport"
  ADD CONSTRAINT "CompatibilityReport_personProfileId_fkey"
  FOREIGN KEY ("personProfileId") REFERENCES "PeopleProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CompatibilityReport_userId_createdAt_idx" ON "CompatibilityReport"("userId", "createdAt");

CREATE TABLE "ChatSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "topicTag" TEXT NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChatSession"
  ADD CONSTRAINT "ChatSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId", "updatedAt");

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "followUps" JSONB,
  "modelUsed" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChatMessage"
  ADD CONSTRAINT "ChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

CREATE TABLE "CoffeeReading" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "visionObservations" JSONB NOT NULL,
  "symbolicMappings" JSONB NOT NULL,
  "interpretation" TEXT NOT NULL,
  "followUpMessages" JSONB,
  "imageQualityFlag" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoffeeReading_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CoffeeReading"
  ADD CONSTRAINT "CoffeeReading_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CoffeeReading_userId_createdAt_idx" ON "CoffeeReading"("userId", "createdAt");

CREATE TABLE "GrowthWeeklyDigest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weekStart" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "themes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrowthWeeklyDigest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GrowthWeeklyDigest"
  ADD CONSTRAINT "GrowthWeeklyDigest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GrowthWeeklyDigest_userId_weekStart_key" ON "GrowthWeeklyDigest"("userId", "weekStart");

CREATE TABLE "LifeChallengeReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challengeClusters" JSONB NOT NULL,
  "interpretation" TEXT NOT NULL,
  "hiddenStrengths" JSONB NOT NULL,
  "practicePrompts" JSONB NOT NULL,
  "transitContext" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LifeChallengeReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LifeChallengeReport"
  ADD CONSTRAINT "LifeChallengeReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "LifeChallengeReport_userId_createdAt_idx" ON "LifeChallengeReport"("userId", "createdAt");

CREATE TABLE "AstroEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "significance" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "whyItMatters" TEXT NOT NULL,
  "suggestedAction" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "windowEnd" TIMESTAMP(3) NOT NULL,
  "notified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AstroEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AstroEvent"
  ADD CONSTRAINT "AstroEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AstroEvent_userId_eventDate_idx" ON "AstroEvent"("userId", "eventDate");

CREATE TABLE "FutureSeerReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "timeWindow" TEXT NOT NULL,
  "upcomingThemes" JSONB NOT NULL,
  "transitSupport" JSONB NOT NULL,
  "timingWindows" JSONB NOT NULL,
  "risks" JSONB NOT NULL,
  "opportunities" JSONB NOT NULL,
  "actionableNow" TEXT NOT NULL,
  "confidenceNote" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FutureSeerReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FutureSeerReport"
  ADD CONSTRAINT "FutureSeerReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "FutureSeerReport_userId_createdAt_idx" ON "FutureSeerReport"("userId", "createdAt");

