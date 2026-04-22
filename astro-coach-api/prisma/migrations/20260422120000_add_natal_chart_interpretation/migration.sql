-- CreateTable
CREATE TABLE "NatalChartInterpretation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "birthDataHash" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL DEFAULT 'v1',
    "synthesisParagraph" TEXT NOT NULL,
    "themeCardsJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NatalChartInterpretation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NatalChartInterpretation_userId_idx" ON "NatalChartInterpretation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NatalChartInterpretation_userId_locale_birthDataHash_promptVersion_key" ON "NatalChartInterpretation"("userId", "locale", "birthDataHash", "promptVersion");

-- AddForeignKey
ALTER TABLE "NatalChartInterpretation" ADD CONSTRAINT "NatalChartInterpretation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
