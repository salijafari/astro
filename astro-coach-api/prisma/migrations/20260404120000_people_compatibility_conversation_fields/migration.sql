-- Align PeopleProfile longitude field name with BirthProfile (FIELD_NAMES.md).
ALTER TABLE "PeopleProfile" RENAME COLUMN "birthLng" TO "birthLong";

CREATE INDEX "PeopleProfile_userId_deletedAt_idx" ON "PeopleProfile"("userId", "deletedAt");

ALTER TABLE "Conversation" ADD COLUMN "personProfileId" TEXT;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_personProfileId_fkey" FOREIGN KEY ("personProfileId") REFERENCES "PeopleProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Conversation_userId_personProfileId_idx" ON "Conversation"("userId", "personProfileId");

ALTER TABLE "CompatibilityReport" ADD COLUMN "isEstimate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompatibilityReport" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fa';
ALTER TABLE "CompatibilityReport" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "CompatibilityReport_userId_personProfileId_key" ON "CompatibilityReport"("userId", "personProfileId");
