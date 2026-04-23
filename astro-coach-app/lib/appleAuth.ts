import { Platform } from "react-native";
import { getFirebaseAuth } from "@/lib/firebase";

const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
};

/**
 * Sign in with Apple — native iOS uses expo-apple-authentication + Firebase credential.
 * Web uses Firebase OAuthProvider popup flow.
 */
export const signInWithApple = async (): Promise<
  import("@react-native-firebase/auth").FirebaseAuthTypes.User | import("firebase/auth").User | null
> => {
  if (Platform.OS === "web") return signInWithAppleWeb();
  if (Platform.OS === "ios") return signInWithAppleNative();
  return null;
};

const signInWithAppleNative = async (): Promise<
  import("@react-native-firebase/auth").FirebaseAuthTypes.User | null
> => {
  try {
    const AppleAuthentication = await import("expo-apple-authentication");
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken } = credential;
    if (!identityToken) throw new Error("No identity token from Apple");

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
    const appleCredential = firebaseAuth.AppleAuthProvider.credential(identityToken);
    const result = await firebaseAuth().signInWithCredential(appleCredential);
    return result.user;
  } catch (error: any) {
    if (error?.code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
};

const signInWithAppleWeb = async (): Promise<import("firebase/auth").User | null> => {
  const { OAuthProvider, signInWithPopup, fetchSignInMethodsForEmail } = await import("firebase/auth");

  const auth = getFirebaseAuth() as import("firebase/auth").Auth;
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: unknown) {
    const code = getFirebaseAuthErrorCode(err);
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return null;
    }
    if (code !== "auth/account-exists-with-different-credential") {
      throw err;
    }
    const authError = err as import("firebase/auth").AuthError;
    const pendingCred = OAuthProvider.credentialFromError(authError);
    const email = authError.customData?.email as string | undefined;
    if (!email || !pendingCred) throw err;
    const methods = await fetchSignInMethodsForEmail(auth, email);
    throw Object.assign(new Error("auth/account-exists-with-different-credential"), {
      email,
      methods,
    });
  }
};
