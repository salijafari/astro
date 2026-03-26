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

// Web (Expo web / PWA) — redirect in the same window so auth state is not lost when
// the popup cannot postMessage back to the opener (common on Expo Web and mobile Safari).
const signInWithGoogleWeb = async () => {
  const { GoogleAuthProvider, signInWithRedirect } = await import("firebase/auth");
  const auth = getFirebaseAuth() as import("firebase/auth").Auth;
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  await signInWithRedirect(auth, provider);
  return null;
};

