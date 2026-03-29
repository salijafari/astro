import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY not set — Stripe web payments disabled");
}

/**
 * Stripe client — null when STRIPE_SECRET_KEY is not configured.
 * All routes that use this must guard with `if (!stripe)` and return 503.
 */
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    })
  : null;

console.log("[stripe] initialization check:", {
  hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
  keyPrefix: process.env.STRIPE_SECRET_KEY?.slice(0, 12),
  hasPriceId: !!process.env.STRIPE_PRICE_ID,
  priceIdPrefix: process.env.STRIPE_PRICE_ID?.slice(0, 10),
});
