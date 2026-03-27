-- AlterTable: Add isAdmin flag to User
ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: ChatSessionSummary
CREATE TABLE "ChatSessionSummary" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "emotionalTone" TEXT NOT NULL,
    "openLoops" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSessionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSessionSummary_sessionId_key" ON "ChatSessionSummary"("sessionId");

-- CreateIndex
CREATE INDEX "ChatSessionSummary_userId_createdAt_idx" ON "ChatSessionSummary"("userId", "createdAt");

-- AddForeignKey: ChatSessionSummary -> ChatSession
ALTER TABLE "ChatSessionSummary" ADD CONSTRAINT "ChatSessionSummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ChatSessionSummary -> User
ALTER TABLE "ChatSessionSummary" ADD CONSTRAINT "ChatSessionSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: AstrologySign
CREATE TABLE "AstrologySign" (
    "id" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "rulingPlanet" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "blindSpots" JSONB NOT NULL,
    "emotionalStyle" TEXT NOT NULL,
    "communicationStyle" TEXT NOT NULL,
    "relationshipStyle" TEXT NOT NULL,
    "workStyle" TEXT NOT NULL,
    "stressPattern" TEXT NOT NULL,
    "growthEdge" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AstrologySign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AstrologySign_sign_key" ON "AstrologySign"("sign");

-- CreateTable: AstrologyPlanet
CREATE TABLE "AstrologyPlanet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "rulesOver" JSONB NOT NULL,
    "healthyExpression" TEXT NOT NULL,
    "difficultExpression" TEXT NOT NULL,
    "inRelationships" TEXT NOT NULL,
    "inDecisionMaking" TEXT NOT NULL,
    "underTransit" TEXT NOT NULL,
    "bodyAndHealth" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AstrologyPlanet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AstrologyPlanet_name_key" ON "AstrologyPlanet"("name");

-- CreateTable: AstrologyHouse
CREATE TABLE "AstrologyHouse" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lifeArea" JSONB NOT NULL,
    "keywords" JSONB NOT NULL,
    "planetHereMeans" TEXT NOT NULL,
    "transitHereMeans" TEXT NOT NULL,
    "naturalRuler" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AstrologyHouse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AstrologyHouse_number_key" ON "AstrologyHouse"("number");

-- CreateTable: AstrologyTransit
CREATE TABLE "AstrologyTransit" (
    "id" TEXT NOT NULL,
    "transitPlanet" TEXT NOT NULL,
    "natalTarget" TEXT NOT NULL,
    "aspect" TEXT NOT NULL,
    "themes" JSONB NOT NULL,
    "emotionalTone" TEXT NOT NULL,
    "practicalExpression" TEXT NOT NULL,
    "timingNote" TEXT NOT NULL,
    "caution" TEXT NOT NULL,
    "domain" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AstrologyTransit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AstrologyTransit_transitPlanet_natalTarget_aspect_key" ON "AstrologyTransit"("transitPlanet", "natalTarget", "aspect");
CREATE INDEX "AstrologyTransit_transitPlanet_natalTarget_idx" ON "AstrologyTransit"("transitPlanet", "natalTarget");

-- CreateTable: TarotCardContent
CREATE TABLE "TarotCardContent" (
    "id" TEXT NOT NULL,
    "cardId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "arcana" TEXT NOT NULL,
    "suit" TEXT,
    "cardNumber" INTEGER NOT NULL,
    "uprightKeywords" JSONB NOT NULL,
    "reversedKeywords" JSONB NOT NULL,
    "uprightMeaning" TEXT NOT NULL,
    "reversedMeaning" TEXT NOT NULL,
    "emotionalTone" TEXT NOT NULL,
    "decisionTone" TEXT NOT NULL,
    "relationshipTone" TEXT NOT NULL,
    "element" TEXT,
    "associatedPlanets" JSONB NOT NULL,
    "associatedSigns" JSONB NOT NULL,
    "visualSymbolismSummary" TEXT NOT NULL,
    "coreLesson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "TarotCardContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TarotCardContent_cardId_key" ON "TarotCardContent"("cardId");

-- CreateTable: CoffeeSymbol
CREATE TABLE "CoffeeSymbol" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "alternateNames" JSONB NOT NULL,
    "themes" JSONB NOT NULL,
    "positiveMeaning" TEXT NOT NULL,
    "shadowMeaning" TEXT NOT NULL,
    "domains" JSONB NOT NULL,
    "reflectionQuestion" TEXT NOT NULL,
    "locationModifier" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CoffeeSymbol_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoffeeSymbol_symbol_key" ON "CoffeeSymbol"("symbol");

-- CreateTable: ConflictFrameworkEntry
CREATE TABLE "ConflictFrameworkEntry" (
    "id" TEXT NOT NULL,
    "conflictTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "likelyDynamic" TEXT NOT NULL,
    "whatPersonANeeds" TEXT NOT NULL,
    "whatPersonBMightNeed" TEXT NOT NULL,
    "escalates" JSONB NOT NULL,
    "deEscalates" JSONB NOT NULL,
    "betterPhrasing" JSONB NOT NULL,
    "astrologicalLens" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ConflictFrameworkEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConflictFrameworkEntry_conflictTypeId_key" ON "ConflictFrameworkEntry"("conflictTypeId");

-- CreateTable: ChallengeLibraryEntry
CREATE TABLE "ChallengeLibraryEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "feelsLike" TEXT NOT NULL,
    "whereItShowsUp" JSONB NOT NULL,
    "triggerPatterns" JSONB NOT NULL,
    "hiddenStrength" TEXT NOT NULL,
    "whatHelps" JSONB NOT NULL,
    "journalQuestion" TEXT NOT NULL,
    "affirmation" TEXT NOT NULL,
    "astrologicalRoots" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ChallengeLibraryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChallengeLibraryEntry_challengeId_key" ON "ChallengeLibraryEntry"("challengeId");

-- CreateTable: AiPromptTemplate
CREATE TABLE "AiPromptTemplate" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AiPromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiPromptTemplate_featureId_templateKey_key" ON "AiPromptTemplate"("featureId", "templateKey");
CREATE INDEX "AiPromptTemplate_featureId_idx" ON "AiPromptTemplate"("featureId");

-- CreateTable: SafetyResponseContent
CREATE TABLE "SafetyResponseContent" (
    "id" TEXT NOT NULL,
    "flagType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "redirectSuggestion" TEXT NOT NULL,
    "showCrisisResources" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SafetyResponseContent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SafetyResponseContent_flagType_key" ON "SafetyResponseContent"("flagType");
