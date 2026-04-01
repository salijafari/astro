-- AlterTable: track which locale AI-generated transit copy used; null = pre-migration (invalidate cache read)
ALTER TABLE "TransitSnapshot" ADD COLUMN "language" TEXT;
