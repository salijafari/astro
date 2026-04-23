import { Platform } from "react-native";
import { getFirebaseAuth } from "@/lib/firebase";

/**
 * Sign in with Apple using native expo-apple-authentication + Firebase credential.
 * iOS only — returns null on web and Android.
 */
export const signInWithApple = async (): Promise<import("@react-native-firebase/auth").FirebaseAuthTypes.User | null> => {
  if (Platform.OS !== "ios") return null;

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
    if (error?.code === "ERR_REQUEST_CANCELED") {
      return null;
    }
    throw error;
  }
};
