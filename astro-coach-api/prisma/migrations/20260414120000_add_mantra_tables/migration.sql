-- Mantra feature: journal fields, notification preference, mantra tables

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "daily_mantra" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "entryType" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "context" TEXT;
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- CreateTable
CREATE TABLE "MantraTemplate" (
    "id" TEXT NOT NULL,
    "planetTag" TEXT NOT NULL,
    "aspectTag" TEXT NOT NULL,
    "signTag" TEXT NOT NULL,
    "qualityTag" TEXT NOT NULL,
    "mantraEn" TEXT NOT NULL,
    "mantraFa" TEXT NOT NULL,
    "mantraEnExploratory" TEXT NOT NULL,
    "mantraFaExploratory" TEXT NOT NULL,
    "themeAffinity" TEXT[] NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MantraTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMantraCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "mantraEn" TEXT NOT NULL,
    "mantraFa" TEXT NOT NULL,
    "mantraEnExploratory" TEXT NOT NULL,
    "mantraFaExploratory" TEXT NOT NULL,
    "tieBackEn" TEXT NOT NULL,
    "tieBackFa" TEXT NOT NULL,
    "dominantTransit" TEXT NOT NULL,
    "planetLabel" TEXT NOT NULL,
    "qualityLabel" TEXT NOT NULL,
    "selectedTheme" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "refreshCount" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshResetDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMantraCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMantraPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "mantraEn" TEXT NOT NULL,
    "mantraFa" TEXT NOT NULL,
    "mantraEnExploratory" TEXT NOT NULL,
    "mantraFaExploratory" TEXT NOT NULL,
    "tieBackEn" TEXT NOT NULL,
    "tieBackFa" TEXT NOT NULL,
    "dominantTransit" TEXT NOT NULL,
    "planetLabel" TEXT NOT NULL,
    "qualityLabel" TEXT NOT NULL,
    "selectedTheme" TEXT,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMantraPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMantraHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMantraHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMantraCache_userId_key" ON "UserMantraCache"("userId");

CREATE UNIQUE INDEX "UserMantraPin_userId_key" ON "UserMantraPin"("userId");

CREATE INDEX "UserMantraHistory_userId_shownAt_idx" ON "UserMantraHistory"("userId", "shownAt");

ALTER TABLE "UserMantraCache" ADD CONSTRAINT "UserMantraCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMantraPin" ADD CONSTRAINT "UserMantraPin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMantraHistory" ADD CONSTRAINT "UserMantraHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
