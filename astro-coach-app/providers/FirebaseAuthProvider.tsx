import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { authApiRef } from "@/lib/authApiRef";
import { awaitFirebaseWebRedirectHandled, getFirebaseAuth } from "@/lib/firebase";
import { configureGoogleSignIn } from "@/lib/googleAuth";

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

/** Minimal user shape shared by web and native Firebase SDKs. */
export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

const Ctx = createContext<FirebaseAuthContextValue | null>(null);

function mapUser(u: unknown): AppUser | null {
  if (!u || typeof u !== "object") return null;
  const o = u as { uid?: string; email?: string | null; displayName?: string | null; getIdToken?: (f?: boolean) => Promise<string> };
  if (!o.uid || !o.getIdToken) return null;
  return {
    uid: o.uid,
    email: o.email ?? null,
    displayName: o.displayName ?? null,
    getIdToken: (forceRefresh?: boolean) => o.getIdToken!(forceRefresh),
  };
}

/**
 * Firebase auth state + sync to Railway PostgreSQL via POST /api/auth/sync after sign-in.
 */
export function FirebaseAuthProvider({ children }: PropsWithChildren): ReactNode {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      let unsub: (() => void) | undefined;
      let cancelled = false;
      void (async () => {
        const auth = getFirebaseAuth() as import("firebase/auth").Auth;
        await awaitFirebaseWebRedirectHandled(auth);
        if (cancelled) return;
        const { onAuthStateChanged } = require("firebase/auth") as typeof import("firebase/auth");
        unsub = onAuthStateChanged(auth, (u) => {
          void (async () => {
            const mapped = mapUser(u);
            if (mapped) {
              try {
                await syncAuthUserToBackend(mapped);
              } catch (e) {
                console.warn("[auth] sync failed after sign-in", e);
              }
            }
            setUser(mapped);
            setLoading(false);
          })();
        });
      })();
      return () => {
        cancelled = true;
        unsub?.();
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
    return nativeAuth().onAuthStateChanged((u) => {
      void (async () => {
        const mapped = mapUser(u);
        if (mapped) {
          try {
            await syncAuthUserToBackend(mapped);
          } catch (e) {
            console.warn("[auth] sync failed after sign-in", e);
          }
        }
        setUser(mapped);
        setLoading(false);
      })();
    });
  }, []);

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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        await nativeAuth().signOut();
      }
    } catch (e) {
      console.warn("[auth] signOut", e);
    }
    setUser(null);
    router.replace("/(onboarding)/language-select");
  }, [router]);

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
