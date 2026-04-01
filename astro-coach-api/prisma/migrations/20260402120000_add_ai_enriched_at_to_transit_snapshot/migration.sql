-- AlterTable
ALTER TABLE "TransitSnapshot" ADD COLUMN "aiEnrichedAt" TIMESTAMP(3);

-- Pre-AI-background snapshots were fully generated synchronously; treat as enriched.
UPDATE "TransitSnapshot" SET "aiEnrichedAt" = "generatedAt" WHERE "aiEnrichedAt" IS NULL;
