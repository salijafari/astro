import { PrismaClient } from "@prisma/client";
import { ZODIAC_SIGNS } from "../src/constants/astrology/signs.js";
import { PLANETS } from "../src/constants/astrology/planets.js";
import { HOUSES } from "../src/constants/astrology/houses.js";
import { TRANSIT_MEANINGS } from "../src/constants/astrology/transits.js";
import { TAROT_DECK } from "../src/constants/tarotDeck.js";
import { COFFEE_SYMBOLS } from "../src/constants/tasseographySymbols.js";
import { CONFLICT_FRAMEWORK } from "../src/constants/conflictFramework.js";
import { CHALLENGE_LIBRARY } from "../src/constants/challengeLibrary.js";
import { SAFETY_RESPONSES } from "../src/constants/safetyResponses.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding astrology meaning databases...");

  // ── Zodiac Signs ─────────────────────────────────────────────────────────────
  console.log("  Seeding zodiac signs...");
  for (const sign of ZODIAC_SIGNS) {
    await prisma.astrologySign.upsert({
      where: { sign: sign.sign },
      update: {
        symbol: sign.symbol,
        element: sign.element,
        modality: sign.modality,
        rulingPlanet: sign.rulingPlanet,
        keywords: sign.keywords,
        strengths: sign.strengths,
        blindSpots: sign.blindSpots,
        emotionalStyle: sign.emotionalStyle,
        communicationStyle: sign.communicationStyle,
        relationshipStyle: sign.relationshipStyle,
        workStyle: sign.workStyle,
        stressPattern: sign.stressPattern,
        growthEdge: sign.growthEdge,
      },
      create: {
        sign: sign.sign,
        symbol: sign.symbol,
        element: sign.element,
        modality: sign.modality,
        rulingPlanet: sign.rulingPlanet,
        keywords: sign.keywords,
        strengths: sign.strengths,
        blindSpots: sign.blindSpots,
        emotionalStyle: sign.emotionalStyle,
        communicationStyle: sign.communicationStyle,
        relationshipStyle: sign.relationshipStyle,
        workStyle: sign.workStyle,
        stressPattern: sign.stressPattern,
        growthEdge: sign.growthEdge,
      },
    });
  }
  console.log(`  ✅ ${ZODIAC_SIGNS.length} zodiac signs seeded.`);

  // ── Planets ──────────────────────────────────────────────────────────────────
  console.log("  Seeding planets...");
  for (const planet of PLANETS) {
    await prisma.astrologyPlanet.upsert({
      where: { name: planet.name },
      update: {
        symbol: planet.symbol,
        keywords: planet.keywords,
        rulesOver: planet.rulesOver,
        healthyExpression: planet.healthyExpression,
        difficultExpression: planet.difficultExpression,
        inRelationships: planet.inRelationships,
        inDecisionMaking: planet.inDecisionMaking,
        underTransit: planet.underTransit,
        bodyAndHealth: planet.bodyAndHealth,
      },
      create: {
        name: planet.name,
        symbol: planet.symbol,
        keywords: planet.keywords,
        rulesOver: planet.rulesOver,
        healthyExpression: planet.healthyExpression,
        difficultExpression: planet.difficultExpression,
        inRelationships: planet.inRelationships,
        inDecisionMaking: planet.inDecisionMaking,
        underTransit: planet.underTransit,
        bodyAndHealth: planet.bodyAndHealth,
      },
    });
  }
  console.log(`  ✅ ${PLANETS.length} planets seeded.`);

  // ── Houses ───────────────────────────────────────────────────────────────────
  console.log("  Seeding houses...");
  for (const house of HOUSES) {
    await prisma.astrologyHouse.upsert({
      where: { number: house.number },
      update: {
        name: house.name,
        lifeArea: house.lifeArea,
        keywords: house.keywords,
        planetHereMeans: house.planetHereMeans,
        transitHereMeans: house.transitHereMeans,
        naturalRuler: house.naturalRuler,
      },
      create: {
        number: house.number,
        name: house.name,
        lifeArea: house.lifeArea,
        keywords: house.keywords,
        planetHereMeans: house.planetHereMeans,
        transitHereMeans: house.transitHereMeans,
        naturalRuler: house.naturalRuler,
      },
    });
  }
  console.log(`  ✅ ${HOUSES.length} houses seeded.`);

  // ── Transit Meanings ─────────────────────────────────────────────────────────
  console.log("  Seeding transit meanings...");
  for (const transit of TRANSIT_MEANINGS) {
    await prisma.astrologyTransit.upsert({
      where: {
        transitPlanet_natalTarget_aspect: {
          transitPlanet: transit.transitPlanet,
          natalTarget: transit.natalTarget,
          aspect: transit.aspect,
        },
      },
      update: {
        themes: transit.themes,
        emotionalTone: transit.emotionalTone,
        practicalExpression: transit.practicalExpression,
        timingNote: transit.timingNote,
        caution: transit.caution,
        domain: transit.domain,
      },
      create: {
        transitPlanet: transit.transitPlanet,
        natalTarget: transit.natalTarget,
        aspect: transit.aspect,
        themes: transit.themes,
        emotionalTone: transit.emotionalTone,
        practicalExpression: transit.practicalExpression,
        timingNote: transit.timingNote,
        caution: transit.caution,
        domain: transit.domain,
      },
    });
  }
  console.log(`  ✅ ${TRANSIT_MEANINGS.length} transit meanings seeded.`);

  // ── Tarot Cards ──────────────────────────────────────────────────────────────
  console.log("  Seeding tarot deck...");
  for (const card of TAROT_DECK) {
    await prisma.tarotCardContent.upsert({
      where: { cardId: card.id },
      update: {
        name: card.name,
        arcana: card.arcana,
        suit: card.suit ?? null,
        cardNumber: card.number,
        uprightKeywords: card.uprightKeywords,
        reversedKeywords: card.reversedKeywords,
        uprightMeaning: card.uprightMeaning,
        reversedMeaning: card.reversedMeaning,
        emotionalTone: card.emotionalTone,
        decisionTone: card.decisionTone,
        relationshipTone: card.relationshipTone,
        element: card.element ?? null,
        associatedPlanets: card.associatedPlanets,
        associatedSigns: card.associatedSigns,
        visualSymbolismSummary: card.visualSymbolismSummary,
        coreLesson: card.coreLesson,
      },
      create: {
        cardId: card.id,
        name: card.name,
        arcana: card.arcana,
        suit: card.suit ?? null,
        cardNumber: card.number,
        uprightKeywords: card.uprightKeywords,
        reversedKeywords: card.reversedKeywords,
        uprightMeaning: card.uprightMeaning,
        reversedMeaning: card.reversedMeaning,
        emotionalTone: card.emotionalTone,
        decisionTone: card.decisionTone,
        relationshipTone: card.relationshipTone,
        element: card.element ?? null,
        associatedPlanets: card.associatedPlanets,
        associatedSigns: card.associatedSigns,
        visualSymbolismSummary: card.visualSymbolismSummary,
        coreLesson: card.coreLesson,
      },
    });
  }
  console.log(`  ✅ ${TAROT_DECK.length} tarot cards seeded.`);

  // ── Coffee Symbols ───────────────────────────────────────────────────────────
  console.log("  Seeding coffee symbols...");
  for (const sym of COFFEE_SYMBOLS) {
    await prisma.coffeeSymbol.upsert({
      where: { symbol: sym.symbol },
      update: {
        alternateNames: sym.alternateNames,
        themes: sym.themes,
        positiveMeaning: sym.positiveMeaning,
        shadowMeaning: sym.shadowMeaning,
        domains: sym.domains,
        reflectionQuestion: sym.reflectionQuestion,
        locationModifier: sym.locationModifier,
      },
      create: {
        symbol: sym.symbol,
        alternateNames: sym.alternateNames,
        themes: sym.themes,
        positiveMeaning: sym.positiveMeaning,
        shadowMeaning: sym.shadowMeaning,
        domains: sym.domains,
        reflectionQuestion: sym.reflectionQuestion,
        locationModifier: sym.locationModifier,
      },
    });
  }
  console.log(`  ✅ ${COFFEE_SYMBOLS.length} coffee symbols seeded.`);

  // ── Conflict Framework ───────────────────────────────────────────────────────
  console.log("  Seeding conflict framework...");
  for (const conflict of CONFLICT_FRAMEWORK) {
    await prisma.conflictFrameworkEntry.upsert({
      where: { conflictTypeId: conflict.id },
      update: {
        label: conflict.label,
        description: conflict.description,
        likelyDynamic: conflict.likelyDynamic,
        whatPersonANeeds: conflict.whatPersonANeeds,
        whatPersonBMightNeed: conflict.whatPersonBMightNeed,
        escalates: conflict.escalates,
        deEscalates: conflict.deEscalates,
        betterPhrasing: conflict.betterPhrasing,
        astrologicalLens: conflict.astrologicalLens,
      },
      create: {
        conflictTypeId: conflict.id,
        label: conflict.label,
        description: conflict.description,
        likelyDynamic: conflict.likelyDynamic,
        whatPersonANeeds: conflict.whatPersonANeeds,
        whatPersonBMightNeed: conflict.whatPersonBMightNeed,
        escalates: conflict.escalates,
        deEscalates: conflict.deEscalates,
        betterPhrasing: conflict.betterPhrasing,
        astrologicalLens: conflict.astrologicalLens,
      },
    });
  }
  console.log(`  ✅ ${CONFLICT_FRAMEWORK.length} conflict types seeded.`);

  // ── Challenge Library ────────────────────────────────────────────────────────
  console.log("  Seeding challenge library...");
  for (const challenge of CHALLENGE_LIBRARY) {
    await prisma.challengeLibraryEntry.upsert({
      where: { challengeId: challenge.id },
      update: {
        title: challenge.title,
        subtitle: challenge.subtitle,
        feelsLike: challenge.feelsLike,
        whereItShowsUp: challenge.whereItShowsUp,
        triggerPatterns: challenge.triggerPatterns,
        hiddenStrength: challenge.hiddenStrength,
        whatHelps: challenge.whatHelps,
        journalQuestion: challenge.journalQuestion,
        affirmation: challenge.affirmation,
        astrologicalRoots: challenge.astrologicalRoots,
      },
      create: {
        challengeId: challenge.id,
        title: challenge.title,
        subtitle: challenge.subtitle,
        feelsLike: challenge.feelsLike,
        whereItShowsUp: challenge.whereItShowsUp,
        triggerPatterns: challenge.triggerPatterns,
        hiddenStrength: challenge.hiddenStrength,
        whatHelps: challenge.whatHelps,
        journalQuestion: challenge.journalQuestion,
        affirmation: challenge.affirmation,
        astrologicalRoots: challenge.astrologicalRoots,
      },
    });
  }
  console.log(`  ✅ ${CHALLENGE_LIBRARY.length} challenges seeded.`);

  // ── Safety Responses ─────────────────────────────────────────────────────────
  console.log("  Seeding safety responses...");
  for (const sr of SAFETY_RESPONSES) {
    await prisma.safetyResponseContent.upsert({
      where: { flagType: sr.flagType },
      update: {
        title: sr.title,
        message: sr.message,
        redirectSuggestion: sr.redirectSuggestion,
        showCrisisResources: sr.showCrisisResources,
      },
      create: {
        flagType: sr.flagType,
        title: sr.title,
        message: sr.message,
        redirectSuggestion: sr.redirectSuggestion,
        showCrisisResources: sr.showCrisisResources,
      },
    });
  }
  console.log(`  ✅ ${SAFETY_RESPONSES.length} safety responses seeded.`);

  console.log("\n✅ Seed complete! All content databases populated.");
  console.log("\nContent counts:");
  console.log(`  Signs:         ${ZODIAC_SIGNS.length} (expected 12)`);
  console.log(`  Planets:       ${PLANETS.length} (expected 11)`);
  console.log(`  Houses:        ${HOUSES.length} (expected 12)`);
  console.log(`  Transits:      ${TRANSIT_MEANINGS.length} (expected ≥200)`);
  console.log(`  Tarot cards:   ${TAROT_DECK.length} (expected 78)`);
  console.log(`  Coffee symbols: ${COFFEE_SYMBOLS.length} (expected ≥60)`);
  console.log(`  Challenges:    ${CHALLENGE_LIBRARY.length} (expected ≥8)`);
  console.log(`  Conflicts:     ${CONFLICT_FRAMEWORK.length} (expected 6)`);
  console.log(`  Safety:        ${SAFETY_RESPONSES.length} (expected 6)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
