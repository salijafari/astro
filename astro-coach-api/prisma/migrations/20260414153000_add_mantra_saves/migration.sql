-- CreateTable
CREATE TABLE "UserMantraSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mantraEn" TEXT NOT NULL,
    "mantraFa" TEXT NOT NULL,
    "tieBackEn" TEXT NOT NULL,
    "tieBackFa" TEXT NOT NULL,
    "planetLabel" TEXT NOT NULL,
    "qualityLabel" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMantraSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMantraSave_userId_savedAt_idx" ON "UserMantraSave"("userId", "savedAt");

-- AddForeignKey
ALTER TABLE "UserMantraSave" ADD CONSTRAINT "UserMantraSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
