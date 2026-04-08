import { Platform } from "react-native";

import { getFirebaseAuth } from "@/lib/firebase";

export type FacebookSignInResult = {
  user: import("firebase/auth").User;
  isNewLink?: boolean;
  linkedMethod?: string;
};

const FACEBOOK_APP_ID = "1486257032945431";
const FACEBOOK_SDK_VERSION = "v25.0";

type FacebookSDK = {
  init: (opts: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (
    cb: (response: { authResponse?: { accessToken?: string } }) => void,
    opts: { scope: string }
  ) => void;
};

declare global {
  interface Window {
    FB?: FacebookSDK;
    fbAsyncInit?: () => void;
  }
}

let facebookSdkLoadPromise: Promise<void> | null = null;

const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  ) {
    return (err as { code: string }).code;
  }
  return null;
};

/**
 * Loads the Facebook JS SDK if not already loaded.
 */
const loadFacebookSDK = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.FB) return Promise.resolve();
  if (facebookSdkLoadPromise) return facebookSdkLoadPromise;

  facebookSdkLoadPromise = new Promise((resolve) => {
    const runInit = () => {
      window.FB?.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: FACEBOOK_SDK_VERSION,
      });
      resolve();
    };

    const previousAsyncInit = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      previousAsyncInit?.();
      runInit();
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });

  return facebookSdkLoadPromise;
};

/**
 * Triggers FB.login() and returns the access token.
 */
const getFacebookAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const FB = window.FB;
    if (!FB) return reject(new Error("Facebook SDK not loaded"));

    FB.login(
      (response) => {
        if (response.authResponse?.accessToken) {
          resolve(response.authResponse.accessToken);
        } else {
          reject(new Error("auth/popup-closed-by-user"));
        }
      },
      { scope: "email,public_profile" }
    );
  });
};

/**
 * Facebook sign-in using Facebook JS SDK + Firebase credential.
 * Works on desktop and mobile browsers without Firebase auth handler.
 */
const signInWithFacebookWeb = async (): Promise<FacebookSignInResult> => {
  const {
    FacebookAuthProvider,
    GoogleAuthProvider,
    signInWithCredential,
    signInWithPopup,
    linkWithCredential,
  } = await import("firebase/auth");
  const auth = getFirebaseAuth() as import("firebase/auth").Auth;

  await loadFacebookSDK();
  const accessToken = await getFacebookAccessToken();
  const credential = FacebookAuthProvider.credential(accessToken);

  try {
    const result = await signInWithCredential(auth, credential);
    return { user: result.user, isNewLink: false };
  } catch (err: unknown) {
    const code = getFirebaseAuthErrorCode(err);
    if (code !== "auth/account-exists-with-different-credential") {
      throw err;
    }

    const authError = err as import("firebase/auth").AuthError;
    const pendingCred = FacebookAuthProvider.credentialFromError(authError);
    const email = authError.customData?.email as string | undefined;
    if (!email || !pendingCred) throw err;

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
 * Facebook sign-in.
 * - Web: Facebook JS SDK flow (works on mobile and desktop).
 * - Native: not implemented — returns null.
 */
export const signInWithFacebook = async (): Promise<FacebookSignInResult | null> => {
  if (Platform.OS === "web") return signInWithFacebookWeb();
  return null;
};

/**
 * Pre-loads the Facebook SDK on auth screen mount so FB.login()
 * can run soon after the user taps (SDK may already be initializing).
 */
export const prewarmFacebookSDK = (): void => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    void loadFacebookSDK().catch(() => {});
  }
};
