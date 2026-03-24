-- Unlimited length for long chat / journal text (matches Prisma @db.Text)
ALTER TABLE "Message" ALTER COLUMN "content" SET DATA TYPE TEXT;
ALTER TABLE "JournalEntry" ALTER COLUMN "content" SET DATA TYPE TEXT;

-- Every user row must be linkable to Clerk or Firebase (prevents orphaned auth-less rows)
DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_auth_id_present" CHECK ("clerkId" IS NOT NULL OR "firebase_uid" IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
