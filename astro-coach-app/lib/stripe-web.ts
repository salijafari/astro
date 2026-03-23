import { Platform } from "react-native";

type StripeCheckoutPayload = {
  checkoutUrl?: string;
};

export async function startWebStripeCheckout(getToken: () => Promise<string | null>): Promise<void> {
  if (Platform.OS !== "web") throw new Error("Stripe checkout is web-only.");
  const token = await getToken();
  if (!token) throw new Error("Not signed in.");
  const apiBase = process.env.EXPO_PUBLIC_API_URL;
  if (!apiBase) throw new Error("Missing EXPO_PUBLIC_API_URL.");

  const response = await fetch(`${apiBase}/api/payments/stripe/checkout-session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ source: "pwa" }),
  });
  if (!response.ok) throw new Error("Failed to create Stripe checkout session.");
  const payload = (await response.json()) as StripeCheckoutPayload;
  if (!payload.checkoutUrl) throw new Error("Stripe checkout URL missing.");
  window.location.assign(payload.checkoutUrl);
}
