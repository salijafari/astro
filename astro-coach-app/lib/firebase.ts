import { Platform } from "react-native";

type WebFirebaseApp = import("firebase/app").FirebaseApp;
type WebAuth = import("firebase/auth").Auth;
type WebFirestore = import("firebase/firestore").Firestore;
type WebMessaging = import("firebase/messaging").Messaging;
type WebAnalytics = import("firebase/analytics").Analytics;

let webApp: WebFirebaseApp | undefined;

/**
 * On web, after Google redirect OAuth, call `getRedirectResult(auth)` once so the pending
 * sign-in completes. Returns the Firebase `User` when a redirect completed; otherwise `null`.
 * Must run before subscribing to `onAuthStateChanged` so routing does not flash sign-in.
 */
export const awaitFirebaseWebRedirectHandled = async (
  auth: import("firebase/auth").Auth,
): Promise<import("firebase/auth").User | null> => {
  if (Platform.OS !== "web") return null;
  try {
    const { getRedirectResult } = await import("firebase/auth");
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log("[firebase] Redirect sign-in completed for:", result.user.uid);
    }
    return result?.user ?? null;
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code) : "";
    if (code !== "auth/no-auth-event") {
      console.warn("[firebase] getRedirectResult error:", error);
    }
    return null;
  }
};

function getWebConfig() {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

/** Firebase Auth — web uses JS SDK; native uses React Native Firebase (native config files). */
export function getFirebaseAuth(): WebAuth | ReturnType<typeof import("@react-native-firebase/auth").default> {
  if (Platform.OS === "web") {
    const { initializeApp, getApps } = require("firebase/app") as typeof import("firebase/app");
    const { getAuth } = require("firebase/auth") as typeof import("firebase/auth");
    if (!getApps().length) {
      webApp = initializeApp(getWebConfig());
    }
    return getAuth(getApps()[0] ?? webApp);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
  return nativeAuth();
}

/** Firestore — web: modular SDK; native: @react-native-firebase/firestore default export as function. */
export function getFirestore(): WebFirestore | ReturnType<typeof import("@react-native-firebase/firestore").default> {
  if (Platform.OS === "web") {
    const { getApps, initializeApp } = require("firebase/app") as typeof import("firebase/app");
    const { getFirestore: gf } = require("firebase/firestore") as typeof import("firebase/firestore");
    if (!getApps().length) {
      webApp = initializeApp(getWebConfig());
    }
    return gf(getApps()[0] ?? webApp);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const firestore = require("@react-native-firebase/firestore").default as typeof import("@react-native-firebase/firestore").default;
  return firestore();
}

/** FCM — native only; web uses Firebase JS messaging when available. */
export function getMessaging(): WebMessaging | null {
  if (Platform.OS === "web") {
    try {
      const { getApps, initializeApp } = require("firebase/app") as typeof import("firebase/app");
      const { getMessaging: gm, isSupported } = require("firebase/messaging") as typeof import("firebase/messaging");
      if (typeof isSupported === "function") {
        void isSupported().then(() => {});
      }
      if (!getApps().length) {
        webApp = initializeApp(getWebConfig());
      }
      return gm(getApps()[0] ?? webApp);
    } catch {
      return null;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const messaging = require("@react-native-firebase/messaging").default as typeof import("@react-native-firebase/messaging").default;
  return messaging();
}

/**
 * Analytics — web: Firebase JS Analytics; native returns null (use @react-native-firebase/analytics in lib/analytics.ts).
 */
export function getAnalytics(): WebAnalytics | null {
  if (Platform.OS === "web") {
    const { getApps, initializeApp } = require("firebase/app") as typeof import("firebase/app");
    const { getAnalytics: ga, isSupported } = require("firebase/analytics") as typeof import("firebase/analytics");
    if (!getApps().length) {
      webApp = initializeApp(getWebConfig());
    }
    const app = getApps()[0] ?? webApp;
    if (typeof isSupported === "function" && !isSupported()) return null;
    return ga(app);
  }
  return null;
}
