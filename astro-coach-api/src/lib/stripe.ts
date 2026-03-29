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
