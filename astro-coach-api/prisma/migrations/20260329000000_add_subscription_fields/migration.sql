-- Rename trialStartDate -> trialStartedAt (field was never written, no data loss)
-- Add stripeCustomerId and stripeSubscriptionId for web Stripe subscriptions
ALTER TABLE "User" DROP COLUMN IF EXISTS "trialStartDate";
ALTER TABLE "User" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
