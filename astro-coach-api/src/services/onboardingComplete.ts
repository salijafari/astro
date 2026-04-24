import type { Prisma } from "@prisma/client";
import { parseBirthDateToUTCNoon } from "../lib/birthDate.js";
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
  options?: { triggeredBy?: string },
): Promise<void> {
  const birthDate = parseBirthDateToUTCNoon(body.birthDate);
  console.info("[birth_profile_upsert]", {
    userId,
    birthCity: body.birthCity,
    hadExplicitCity: Boolean(body.birthCity?.trim()),
    triggeredBy: options?.triggeredBy ?? "persistCompleteOnboarding",
  });
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
  });
  // Consent logging should not block onboarding completion. If this insert fails
  // due data drift/constraints in production, keep the user unblocked and retry later.
  try {
    await prisma.consentRecord.create({
      data: {
        userId,
        consentType: "birth_data_storage",
        version: body.consentVersion,
        ipAddress,
      },
    });
  } catch (err) {
    console.error("[onboarding] consentRecord.create failed (non-blocking)", String(err));
  }
}
