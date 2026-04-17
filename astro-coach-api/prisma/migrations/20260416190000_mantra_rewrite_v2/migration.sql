-- Mantra v2: template columns, history/pin augments, UserMantraPractice, User.reminder, data bridge, drop legacy cache/save

-- MantraTemplate: new v2 columns (keep legacy columns for Phase 6)
ALTER TABLE "MantraTemplate" ADD COLUMN "primaryQuality" TEXT NOT NULL DEFAULT 'patience';
ALTER TABLE "MantraTemplate" ADD COLUMN "secondaryQualities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MantraTemplate" ADD COLUMN "mantraEnDirect" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MantraTemplate" ADD COLUMN "mantraFaDirect" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MantraTemplate" ADD COLUMN "faReviewStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "MantraTemplate" ADD COLUMN "authorNotes" TEXT;
ALTER TABLE "MantraTemplate" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "MantraTemplate"
SET
  "mantraEnDirect" = "mantraEn",
  "mantraFaDirect" = "mantraFa",
  "primaryQuality" = CASE LOWER(TRIM("qualityTag"))
    WHEN 'discipline' THEN 'discipline'
    WHEN 'communication' THEN 'clarity'
    WHEN 'love' THEN 'connection'
    WHEN 'action' THEN 'courage'
    WHEN 'expansion' THEN 'expansion'
    WHEN 'intuition' THEN 'clarity'
    WHEN 'identity' THEN 'worth'
    WHEN 'surrender' THEN 'letting-go'
    WHEN 'transformation' THEN 'rebuilding'
    WHEN 'healing' THEN 'softness'
    WHEN 'growth' THEN 'expansion'
    WHEN 'focus' THEN 'discipline'
    WHEN 'calm' THEN 'softness'
    WHEN 'confidence' THEN 'worth'
    WHEN 'self-worth' THEN 'worth'
    WHEN 'release' THEN 'letting-go'
    WHEN 'hope' THEN 'expansion'
    WHEN 'faith' THEN 'connection'
    WHEN 'general' THEN 'groundedness'
    ELSE 'patience'
  END;

CREATE INDEX "MantraTemplate_primaryQuality_isActive_idx" ON "MantraTemplate"("primaryQuality", "isActive");
CREATE INDEX "MantraTemplate_isActive_idx" ON "MantraTemplate"("isActive");

-- UserMantraHistory
ALTER TABLE "UserMantraHistory" ADD COLUMN "qualityTag" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "UserMantraHistory" ADD COLUMN "transitSummary" TEXT;
ALTER TABLE "UserMantraHistory" ADD COLUMN "registerShown" TEXT NOT NULL DEFAULT 'exploratory';
ALTER TABLE "UserMantraHistory" ADD COLUMN "tieBackEn" TEXT;
ALTER TABLE "UserMantraHistory" ADD COLUMN "tieBackFa" TEXT;

-- UserMantraPin
ALTER TABLE "UserMantraPin" ADD COLUMN "qualityTag" TEXT NOT NULL DEFAULT 'unknown';

-- User
ALTER TABLE "User" ADD COLUMN "mantraReminderTime" TEXT;

-- UserMantraPractice
CREATE TABLE "UserMantraPractice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "mantraText" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "register" TEXT NOT NULL,
    "practiceMode" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalNote" TEXT,
    "qualityTag" TEXT NOT NULL DEFAULT 'unknown',
    "qualityLabelEn" TEXT NOT NULL DEFAULT '',
    "qualityLabelFa" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "UserMantraPractice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserMantraPractice_userId_completedAt_idx" ON "UserMantraPractice"("userId", "completedAt");

ALTER TABLE "UserMantraPractice" ADD CONSTRAINT "UserMantraPractice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMantraPractice" ADD CONSTRAINT "UserMantraPractice_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MantraTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bridge: saved bookmarks → practice rows (before dropping saves)
INSERT INTO "UserMantraPractice" (
  "id",
  "userId",
  "templateId",
  "mantraText",
  "language",
  "register",
  "practiceMode",
  "durationSec",
  "completedAt",
  "journalNote",
  "qualityTag",
  "qualityLabelEn",
  "qualityLabelFa"
)
SELECT
  "id",
  "userId",
  NULL,
  "mantraEn",
  'en',
  'direct',
  'silent',
  0,
  "savedAt",
  NULL,
  'unknown',
  "qualityLabel",
  "qualityLabel"
FROM "UserMantraSave";

-- Drop legacy tables
DROP TABLE IF EXISTS "UserMantraSave";
DROP TABLE IF EXISTS "UserMantraCache";
