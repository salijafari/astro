import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { syncAuthUserToBackend } from "@/lib/authSync";
import { authApiRef } from "@/lib/authApiRef";
import { awaitFirebaseWebRedirectHandled, getFirebaseAuth } from "@/lib/firebase";
import { configureGoogleSignIn } from "@/lib/googleAuth";

export type AuthProviderInfo = {
  providerId: string;
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
};

/** Minimal user shape shared by web and native Firebase SDKs (includes token helper for API sync). */
export type AppUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  providerData: AuthProviderInfo[];
  /** ISO creation time when available */
  creationTime: string | null;
  /** ISO last sign-in when available */
  lastSignInTime: string | null;
  isAnonymous: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export type FirebaseAuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  onAuthFailure: () => Promise<void>;
};

const Ctx = createContext<FirebaseAuthContextValue | null>(null);

function mapWebUser(u: import("firebase/auth").User): AppUser {
  const md = u.metadata;
  return {
    uid: u.uid,
    email: u.email,
    emailVerified: Boolean(u.emailVerified),
    displayName: u.displayName,
    photoURL: u.photoURL,
    phoneNumber: u.phoneNumber,
    providerData: u.providerData.map((p) => ({
      providerId: p.providerId,
      uid: p.uid,
      displayName: p.displayName ?? null,
      email: p.email ?? null,
      phoneNumber: p.phoneNumber ?? null,
      photoURL: p.photoURL ?? null,
    })),
    creationTime: md.creationTime ?? null,
    lastSignInTime: md.lastSignInTime ?? null,
    isAnonymous: u.isAnonymous,
    getIdToken: (forceRefresh?: boolean) => u.getIdToken(forceRefresh),
  };
}

function mapNativeUser(u: import("@react-native-firebase/auth").FirebaseAuthTypes.User): AppUser {
  const md = u.metadata;
  return {
    uid: u.uid,
    email: u.email,
    emailVerified: Boolean(u.emailVerified),
    displayName: u.displayName,
    photoURL: u.photoURL,
    phoneNumber: u.phoneNumber,
    providerData: u.providerData.map((p) => ({
      providerId: p.providerId,
      uid: p.uid,
      displayName: p.displayName ?? null,
      email: p.email ?? null,
      phoneNumber: p.phoneNumber ?? null,
      photoURL: p.photoURL ?? null,
    })),
    creationTime: md.creationTime ?? null,
    lastSignInTime: md.lastSignInTime ?? null,
    isAnonymous: u.isAnonymous,
    getIdToken: (forceRefresh?: boolean) => u.getIdToken(forceRefresh),
  };
}

type RNFirebaseAuthExport = typeof import("@react-native-firebase/auth").default;

function getRNFirebaseAuthExport(): RNFirebaseAuthExport {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-firebase/auth").default;
}

function getNativeAuth(): import("@react-native-firebase/auth").FirebaseAuthTypes.Module {
  return getRNFirebaseAuthExport()();
}

/**
 * Firebase auth helpers that always use the **current** user at call time (not a stale closure).
 * Use from Settings / account flows after `useFirebaseAuth().user` is non-null.
 */
export const firebaseAuthActions = {
  reload: async (): Promise<void> => {
    if (Platform.OS === "web") {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const { reload } = await import("firebase/auth");
      const u = auth.currentUser;
      if (!u) throw new Error("no_user");
      await reload(u);
    } else {
      const u = getNativeAuth().currentUser;
      if (!u) throw new Error("no_user");
      await u.reload();
    }
  },

  sendEmailVerification: async (): Promise<void> => {
    if (Platform.OS === "web") {
      /** `getFirebaseAuth()` initializes the web app if needed; read `currentUser` at call time (not from React state). */
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const { sendEmailVerification } = await import("firebase/auth");
      const u = auth.currentUser;
      if (!u) throw new Error("no_user");
      await sendEmailVerification(u);
    } else {
      const u = getRNFirebaseAuthExport()().currentUser;
      if (!u) throw new Error("no_user");
      await u.sendEmailVerification();
    }
  },

  updateEmail: async (newEmail: string): Promise<void> => {
    if (Platform.OS === "web") {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const { updateEmail } = await import("firebase/auth");
      const u = auth.currentUser;
      if (!u) throw new Error("no_user");
      await updateEmail(u, newEmail);
    } else {
      const u = getNativeAuth().currentUser;
      if (!u) throw new Error("no_user");
      await u.updateEmail(newEmail);
    }
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    if (Platform.OS === "web") {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const { updatePassword } = await import("firebase/auth");
      const u = auth.currentUser;
      if (!u) throw new Error("no_user");
      await updatePassword(u, newPassword);
    } else {
      const u = getNativeAuth().currentUser;
      if (!u) throw new Error("no_user");
      await u.updatePassword(newPassword);
    }
  },

  reauthenticateWithPassword: async (email: string, password: string): Promise<void> => {
    if (Platform.OS === "web") {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
      const u = auth.currentUser;
      if (!u) throw new Error("no_user");
      const cred = EmailAuthProvider.credential(email, password);
      await reauthenticateWithCredential(u, cred);
    } else {
      const u = getNativeAuth().currentUser;
      if (!u) throw new Error("no_user");
      const cred = getRNFirebaseAuthExport().EmailAuthProvider.credential(email, password);
      await u.reauthenticateWithCredential(cred);
    }
  },
};

/**
 * Firebase auth state + sync to Railway PostgreSQL via POST /api/auth/sync after sign-in.
 */
export function FirebaseAuthProvider({ children }: PropsWithChildren): ReactNode {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  /** Web: false until `getRedirectResult` finishes so we subscribe after redirect is consumed. */
  const [webRedirectReady, setWebRedirectReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    void (async () => {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const firebaseUser = await awaitFirebaseWebRedirectHandled(auth);
      if (cancelled) return;
      if (firebaseUser) {
        const mapped = mapWebUser(firebaseUser);
        setUser(mapped);
        setLoading(false);
        void syncAuthUserToBackend(mapped).catch((e) => {
          console.warn("[auth] sync failed after redirect sign-in", e);
        });
      }
      setWebRedirectReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return getNativeAuth().onAuthStateChanged((u) => {
        const mapped = u ? mapNativeUser(u) : null;
        setUser(mapped);
        setLoading(false);
        if (mapped) {
          void syncAuthUserToBackend(mapped).catch((e) => {
            console.warn("[auth] sync failed after sign-in", e);
          });
        }
      });
    }
    if (!webRedirectReady) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void (async () => {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const { onAuthStateChanged } = await import("firebase/auth");
      await auth.authStateReady();
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, (u) => {
        const mapped = u ? mapWebUser(u) : null;
        setUser(mapped);
        setLoading(false);
        if (mapped) {
          void syncAuthUserToBackend(mapped).catch((e) => {
            console.warn("[auth] sync failed after sign-in", e);
          });
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [webRedirectReady]);

  const getToken = useCallback(async () => {
    if (!user) return null;
    try {
      return await user.getIdToken(false);
    } catch {
      return null;
    }
  }, [user]);

  const refreshToken = useCallback(async () => {
    if (!user) return null;
    try {
      return await user.getIdToken(true);
    } catch {
      return null;
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      if (Platform.OS === "web") {
        const { signOut: webSignOut } = require("firebase/auth") as typeof import("firebase/auth");
        await webSignOut(auth as import("firebase/auth").Auth);
      } else {
        await getNativeAuth().signOut();
      }
    } catch (e) {
      console.warn("[auth] signOut", e);
    }
    setUser(null);
  }, []);

  const onAuthFailure = useCallback(async () => {
    await signOut();
  }, [signOut]);

  useEffect(() => {
    authApiRef.refreshToken = refreshToken;
    authApiRef.onAuthFailure = onAuthFailure;
    return () => {
      authApiRef.refreshToken = undefined;
      authApiRef.onAuthFailure = undefined;
    };
  }, [refreshToken, onAuthFailure]);

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      user,
      loading,
      isLoaded: !loading,
      isSignedIn: !!user,
      userId: user?.uid ?? null,
      signOut,
      getToken,
      refreshToken,
      onAuthFailure,
    }),
    [user, loading, signOut, getToken, refreshToken, onAuthFailure],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFirebaseAuth must be used within FirebaseAuthProvider");
  return v;
}
