import { adminMessaging } from "../lib/firebase-admin.js";
import { prisma } from "../lib/prisma.js";

export type PushPayload = { title: string; body: string; data?: Record<string, string> };

/**
 * Sends a notification to every stored FCM token for a user; prunes invalid tokens.
 */
export async function sendToUser(userId: string, notification: PushPayload): Promise<{ sent: number; failed: number }> {
  const rows = await prisma.fcmToken.findMany({ where: { userId } });
  if (rows.length === 0) return { sent: 0, failed: 0 };

  const tokenStrings = rows.map((r) => r.token);
  const res = await adminMessaging.sendEachForMulticast({
    tokens: tokenStrings,
    notification: { title: notification.title, body: notification.body },
    data: notification.data,
  });

  for (let i = 0; i < res.responses.length; i++) {
    const resp = res.responses[i];
    if (!resp) continue;
    if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
      const tok = tokenStrings[i];
      if (tok) await prisma.fcmToken.deleteMany({ where: { token: tok } });
    }
  }

  return { sent: res.successCount, failed: res.failureCount };
}

/**
 * Placeholder daily horoscope push — replace body copy with chart/LLM pipeline later.
 */
export async function sendDailyHoroscope(userId: string): Promise<void> {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (pref && !pref.dailyHoroscope) return;

  await sendToUser(userId, {
    title: "Your daily insight",
    body: "A gentle nudge from the stars — open Akhtar for today’s reading.",
    data: { type: "daily_horoscope" },
  });
}
