import { Platform } from "react-native";

import { getFirebaseAuth } from "@/lib/firebase";

const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
};

/**
 * Facebook sign-in (Firebase).
 * - Web: `signInWithPopup` with `FacebookAuthProvider` (enable Facebook in Firebase Console).
 * - Native: not implemented — requires `react-native-fbsdk-next`; returns `null`.
 */
const signInWithFacebookWeb = async (): Promise<import("firebase/auth").User | null> => {
  const { FacebookAuthProvider, signInWithPopup } = await import("firebase/auth");
  const auth = getFirebaseAuth() as import("firebase/auth").Auth;
  const provider = new FacebookAuthProvider();
  provider.addScope("email");
  provider.addScope("public_profile");

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    if (getFirebaseAuthErrorCode(err) === "auth/account-exists-with-different-credential") {
      throw new Error("auth/account-exists-with-different-credential");
    }
    throw err;
  }
};

/**
 * Starts Facebook sign-in. Web only until native `react-native-fbsdk-next` is added.
 */
export const signInWithFacebook = async (): Promise<import("firebase/auth").User | null> => {
  if (Platform.OS === "web") return signInWithFacebookWeb();
  return null;
};
