-- Add language preference to User table
-- Defaults to 'fa' (Persian) to match existing app behaviour
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'fa';
