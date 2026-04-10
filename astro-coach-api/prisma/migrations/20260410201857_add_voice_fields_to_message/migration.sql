-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "inputMode" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "transcript" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "inputMode" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "transcript" TEXT;
