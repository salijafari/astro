import { Platform } from "react-native";

import { getFirebaseAuth } from "@/lib/firebase";

export type FacebookSignInResult = {
  user: import("firebase/auth").User;
  isNewLink?: boolean;
  linkedMethod?: string;
};

const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
};

/**
 * Facebook sign-in (Firebase web) with automatic link when the same email exists on Google.
 */
const signInWithFacebookWeb = async (): Promise<FacebookSignInResult> => {
  const {
    FacebookAuthProvider,
    GoogleAuthProvider,
    signInWithPopup,
    linkWithCredential,
  } = await import("firebase/auth");
  const auth = getFirebaseAuth() as import("firebase/auth").Auth;
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");
  try {
    const result = await signInWithPopup(auth, provider);
    return { user: result.user, isNewLink: false };
  } catch (err: unknown) {
    const code = getFirebaseAuthErrorCode(err);
    if (code !== "auth/account-exists-with-different-credential") {
      throw err;
    }
    const authError = err as import("firebase/auth").AuthError;
    const pendingCred = FacebookAuthProvider.credentialFromError(authError);
    const email = authError.customData?.email as string | undefined;
    if (!email || !pendingCred) {
      throw err;
    }
    const googleProvider = new GoogleAuthProvider();
    try {
      const googleResult = await signInWithPopup(auth, googleProvider);
      await linkWithCredential(googleResult.user, pendingCred);
      return { user: googleResult.user, isNewLink: true, linkedMethod: "google.com" };
    } catch {
      throw Object.assign(new Error("auth/account-exists-with-different-credential"), {
        email,
        methods: ["google.com"],
      });
    }
  }
};

/**
 * Facebook sign-in (Firebase).
 * - Web: `signInWithPopup` with optional Google→Facebook account link when email matches Google.
 * - Native: not implemented — requires `react-native-fbsdk-next`; returns `null`.
 */
export const signInWithFacebook = async (): Promise<FacebookSignInResult | null> => {
  if (Platform.OS === "web") return signInWithFacebookWeb();
  return null;
};

/**
 * Pre-warms the firebase/auth dynamic import so signInWithPopup can fire
 * synchronously from a user gesture on mobile Safari.
 */
export const prewarmFirebaseAuth = (): void => {
  void import("firebase/auth").catch(() => {});
};
