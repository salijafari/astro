import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type CompleteOnboardingPayload = {
  name: string;
  birthDate: string;
  birthTime: string | null;
  birthCity: string;
  birthLat: number;
  birthLong: number;
  birthTimezone: string;
  interestTags: string[];
  consentVersion: string;
  natalChartJson: Prisma.InputJsonValue;
  sunSign: string;
  moonSign: string;
  risingSign: string | null;
};

/**
 * Persists onboarding completion: User row, BirthProfile, and consent record (Section 5 PIPEDA).
 */
export async function persistCompleteOnboarding(
  userId: string,
  body: CompleteOnboardingPayload,
  ipAddress: string | undefined,
): Promise<void> {
  const birthDate = new Date(body.birthDate);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { name: body.name, onboardingComplete: true },
    });
    await tx.birthProfile.upsert({
      where: { userId },
      create: {
        userId,
        birthDate,
        birthTime: body.birthTime,
        birthCity: body.birthCity,
        birthLat: body.birthLat,
        birthLong: body.birthLong,
        birthTimezone: body.birthTimezone,
        sunSign: body.sunSign,
        moonSign: body.moonSign,
        risingSign: body.risingSign,
        natalChartJson: body.natalChartJson,
        interestTags: body.interestTags,
      },
      update: {
        birthDate,
        birthTime: body.birthTime,
        birthCity: body.birthCity,
        birthLat: body.birthLat,
        birthLong: body.birthLong,
        birthTimezone: body.birthTimezone,
        sunSign: body.sunSign,
        moonSign: body.moonSign,
        risingSign: body.risingSign,
        natalChartJson: body.natalChartJson,
        interestTags: body.interestTags,
      },
    });
    await tx.consentRecord.create({
      data: {
        userId,
        consentType: "birth_data_storage",
        version: body.consentVersion,
        ipAddress,
      },
    });
  });
}
