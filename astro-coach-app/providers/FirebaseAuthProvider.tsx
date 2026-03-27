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
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  /** Web: false until `getRedirectResult` finishes so we subscribe after redirect is consumed. */
  const [webRedirectReady, setWebRedirectReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  /**
   * Run redirect resolution in layout (before child useEffects) so OAuth query params are
   * consumed before Expo Router / sign-in screens run; apply user immediately for routing.
   */
  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    void (async () => {
      const auth = getFirebaseAuth() as import("firebase/auth").Auth;
      const firebaseUser = await awaitFirebaseWebRedirectHandled(auth);
      // #region agent log
      fetch('http://127.0.0.1:7540/ingest/b6053cb9-71c3-43d1-8fff-14ee365fa687',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'00b340'},body:JSON.stringify({sessionId:'00b340',location:'providers/FirebaseAuthProvider.tsx:75',message:'Redirect handled result',data:{hasFirebaseUser: !!firebaseUser, uid: firebaseUser?.uid, cancelled},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (cancelled) return;
      const mapped = mapUser(firebaseUser);
      if (mapped) {
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
      return nativeAuth().onAuthStateChanged((u) => {
        const mapped = mapUser(u);
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
        // #region agent log
        fetch('http://127.0.0.1:7540/ingest/b6053cb9-71c3-43d1-8fff-14ee365fa687',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'00b340'},body:JSON.stringify({sessionId:'00b340',location:'providers/FirebaseAuthProvider.tsx:115',message:'onAuthStateChanged fired',data:{hasUser: !!u, uid: u?.uid},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const mapped = mapUser(u);
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        await nativeAuth().signOut();
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
