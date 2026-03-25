import admin from "firebase-admin";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Messaging } from "firebase-admin/messaging";

// Prevent multiple initialization errors
const initializeFirebaseAdmin = () => {
  // Return existing app if already initialized
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Log which vars are missing without exposing values
  if (!projectId || !clientEmail || !privateKey) {
    const missing = [];
    if (!projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY");
    console.warn("⚠️  Firebase Admin: missing env vars:", missing.join(", "));
    console.warn("⚠️  Firebase auth verification will be disabled");
    return null;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Critical: Railway stores \n as literal \\n in env vars
        // This converts them back to real newlines
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    return null;
  }
};

const firebaseAdminApp: App | null = initializeFirebaseAdmin();

export const adminAuth: Auth | null = firebaseAdminApp ? admin.auth(firebaseAdminApp) : null;

export const adminMessaging: Messaging | null = firebaseAdminApp ? admin.messaging(firebaseAdminApp) : null;

export const isFirebaseAdminInitialized = firebaseAdminApp !== null;
