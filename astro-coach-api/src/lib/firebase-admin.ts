import type { Auth } from "firebase-admin/auth";
import type { Messaging } from "firebase-admin/messaging";
import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!admin.apps.length && projectId && clientEmail && privateKey) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

/** Firebase Admin Auth — verify ID tokens from the mobile/web app. */
export const adminAuth: Auth = admin.auth();

/** Firebase Cloud Messaging (V1) — server-side push. */
export const adminMessaging: Messaging = admin.messaging();
