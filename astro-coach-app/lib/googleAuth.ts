import { Platform } from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { getFirebaseAuth } from "@/lib/firebase";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * Configure Google Sign-In once at app startup.
 * - Web uses Firebase redirect flow (see `signInWithGoogleWeb`); popups often fail to
 *   return the session to the opener on Expo Web / mobile Safari / strict browsers.
 */
export const configureGoogleSignIn = () => {
  if (Platform.OS === "web") return;
  if (!WEB_CLIENT_ID) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (required for native Google Sign-In).");
  }
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    offlineAccess: true,
  });
};

/**
 * Starts Google sign-in. On web this triggers a full-page redirect; the app must call
 * `getRedirectResult` on startup (`FirebaseAuthProvider`) so the session is applied.
 */
export const signInWithGoogle = async () => {
  if (Platform.OS === "web") return signInWithGoogleWeb();
  return signInWithGoogleNative();
};

// Native (iOS + Android) flow
const signInWithGoogleNative = async () => {
  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    const userInfo = await GoogleSignin.signIn();

    // Library versions differ; idToken may be at root or under data.
    const idToken =
      (userInfo as unknown as { idToken?: string | null }).idToken ??
      (userInfo as unknown as { data?: { idToken?: string | null } }).data?.idToken ??
      null;

    if (!idToken) {
      throw new Error("No ID token received from Google");
    }

    // Use React Native Firebase on native platforms.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
    const credential = firebaseAuth.GoogleAuthProvider.credential(idToken);
    const result = await firebaseAuth().signInWithCredential(credential);
    return result.user;
  } catch (error: any) {
    if (error?.code === "SIGN_IN_CANCELLED") {
      return null;
    }
    throw error;
  }
};

/**
 * Web popup flow.
 * Using popup instead of redirect to avoid issues with the Firebase auth handler
 * bouncing users back to the login page without completing the session.
 */
const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
};

const POPUP_CANCEL_GRACE_MS = 1500;

const buildPopupCancelWatchdog = (): { promise: Promise<"cancelled">; stop: () => void } => {
  if (typeof window === "undefined") {
    return { promise: new Promise<"cancelled">(() => {}), stop: () => {} };
  }

  let focusReturnedAt: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let resolveCancel: ((value: "cancelled") => void) | null = null;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("focus", onFocus);
    if (intervalId) clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
    intervalId = null;
    timeoutId = null;
  };

  const onFocus = () => {
    if (stopped) return;
    focusReturnedAt = Date.now();
  };

  const promise = new Promise<"cancelled">((resolve) => {
    resolveCancel = resolve;
  });

  window.addEventListener("focus", onFocus);
  intervalId = setInterval(() => {
    if (stopped || focusReturnedAt === null) return;
    if (Date.now() - focusReturnedAt >= POPUP_CANCEL_GRACE_MS) {
      stop();
      resolveCancel?.("cancelled");
    }
  }, 250);
  timeoutId = setTimeout(() => {
    stop();
  }, 30000);

  return { promise, stop };
};

const signInWithGoogleWeb = async (): Promise<import("firebase/auth").User | null> => {
  const {
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    fetchSignInMethodsForEmail,
    linkWithCredential,
  } = await import("firebase/auth");
  const auth = getFirebaseAuth() as import("firebase/auth").Auth;
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });

  const { promise: cancelWatchdog, stop: stopCancelWatchdog } = buildPopupCancelWatchdog();
  const signInWrapped = signInWithPopup(auth, provider)
    .then((result) => ({ kind: "success" as const, result }))
    .catch((error: unknown) => ({ kind: "error" as const, error }));
  const watchdogWrapped = cancelWatchdog.then(() => ({ kind: "cancelled" as const }));
  const raced = await Promise.race([signInWrapped, watchdogWrapped]);
  stopCancelWatchdog();

  if (raced.kind === "cancelled") {
    return null;
  }

  if (raced.kind === "success") {
    return raced.result.user;
  }

  const err = raced.error;
  const code = getFirebaseAuthErrorCode(err);
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return null;
  }
  if (code !== "auth/account-exists-with-different-credential") {
    throw err;
  }

  const authError = err as import("firebase/auth").AuthError;
  const pendingCred = GoogleAuthProvider.credentialFromError(authError);
  const email = authError.customData?.email as string | undefined;

  if (!email || !pendingCred) {
    throw err;
  }

  const methods = await fetchSignInMethodsForEmail(auth, email);

  if (methods.includes("facebook.com")) {
    const facebookProvider = new FacebookAuthProvider();
    const fbResult = await signInWithPopup(auth, facebookProvider);
    await linkWithCredential(fbResult.user, pendingCred);
    return fbResult.user;
  }

  throw Object.assign(new Error("auth/account-exists-with-different-credential"), {
    email,
    methods,
  });
};

