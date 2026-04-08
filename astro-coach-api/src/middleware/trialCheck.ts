import type { Context, Next } from "hono";
import { prisma } from "../lib/prisma.js";

// IMPORTANT: This middleware's premium/access logic must mirror hasFeatureAccess()
// in src/lib/revenuecat.ts. If you change access rules in one place,
// update the other. Divergence causes inconsistent behavior where
// middleware allows a request but the route handler denies it (or vice versa).
//
// Note: hasFeatureAccess also grants access via RevenueCat before DB checks;
// this middleware cannot call RC and only mirrors the DATABASE portion of
// hasFeatureAccess (active / premiumUnlimited / premium / trial).

const TRIAL_DURATION_DAYS = 7;

/**
 * Trial expiry enforcement for routes that use this middleware.
 *
 * Applied AFTER requireFirebaseAuth so firebaseUid and dbUserId are available.
 * Must NOT be applied to: auth, onboarding, subscription, health routes.
 *
 * Premium path mirrors src/lib/revenuecat.ts hasFeatureAccess (DB checks only).
 * Then: trial claimed and < 7 days → allow; trial expired → 402 trial_expired;
 * no trial claimed → next() (routes still gate via hasFeatureAccess).
 */
export async function trialCheckMiddleware(c: Context, next: Next): Promise<Response | void> {
  const dbId: string | undefined = c.get("dbUserId");
  if (!dbId) return next();

  const user = await prisma.user.findUnique({
    where: { id: dbId },
    select: {
      subscriptionStatus: true,
      trialStartedAt: true,
      premiumExpiresAt: true,
      premiumUnlimited: true,
    },
  });

  if (!user) return next();

  if (user.subscriptionStatus === "active") {
    return next();
  }

  if (user.premiumUnlimited) {
    return next();
  }

  if (user.subscriptionStatus === "premium" && user.premiumExpiresAt) {
    if (new Date() < new Date(user.premiumExpiresAt)) {
      return next();
    }
  } else if (
    user.subscriptionStatus === "premium" &&
    !user.premiumExpiresAt &&
    !user.premiumUnlimited
  ) {
    // AMBIGUOUS STATE: subscriptionStatus === "premium" with no premiumExpiresAt
    // and premiumUnlimited === false. This can occur from legacy data or
    // admin grants without explicit expiry. Treating as indefinite premium
    // to match hasFeatureAccess behavior. If this state is found in production,
    // it should be audited and cleaned up.
    return next();
  }

  if (user.trialStartedAt) {
    const daysSinceTrial =
      (Date.now() - new Date(user.trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceTrial < TRIAL_DURATION_DAYS) return next();

    const trialExpiredAt = new Date(
      user.trialStartedAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );
    return c.json(
      {
        error: "trial_expired",
        message: "Your free trial has ended. Please subscribe to continue.",
        trialExpiredAt,
      },
      402,
    );
  }

  return next();
}
