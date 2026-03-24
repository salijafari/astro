-- PIPEDA: consent rows must cascade-delete with User (init migration normally adds this FK).
-- Idempotent: only add if a DB was created without the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsentRecord_userId_fkey'
  ) THEN
    ALTER TABLE "ConsentRecord"
      ADD CONSTRAINT "ConsentRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
