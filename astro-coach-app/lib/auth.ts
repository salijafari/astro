import type { PropsWithChildren, ReactNode } from "react";
import { FirebaseAuthProvider, useFirebaseAuth, type AppUser } from "@/providers/FirebaseAuthProvider";

export type { AppUser };

/** @deprecated Use FirebaseAuthProvider — alias kept so existing imports keep working. */
export const AuthProvider = FirebaseAuthProvider;

export function AuthLoaded({ children }: PropsWithChildren): ReactNode {
  return children;
}

export type AuthState = {
  user: AppUser | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

type GetTokenFn = () => Promise<string | null>;

export interface TokenRetryOptions {
  attempts?: number;
  delayMs?: number;
}

/**
 * Calls getToken() up to `attempts` times, waiting `delayMs` between attempts.
 * Returns the first non-null token, or null if all attempts fail.
 *
 * Used by screens that need to make authenticated API calls at cold start,
 * where `getIdToken(false)` can transiently fail even after the Firebase
 * Auth user is hydrated.
 */
export async function getTokenWithRetry(
  getToken: GetTokenFn,
  options: TokenRetryOptions = {},
): Promise<string | null> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 500;

  for (let i = 0; i < attempts; i++) {
    try {
      const token = await getToken();
      if (token) return token;
    } catch {
      /* fall through to retry */
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
}

export function useAuth(): AuthState & { loading: boolean; onAuthFailure: () => Promise<void> } {
  const a = useFirebaseAuth();
  return {
    user: a.user,
    loading: a.loading,
    isLoaded: a.isLoaded,
    isSignedIn: a.isSignedIn,
    userId: a.userId,
    getToken: a.getToken,
    refreshToken: a.refreshToken,
    signOut: a.signOut,
    onAuthFailure: a.onAuthFailure,
  };
}
