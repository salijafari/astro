import type { PropsWithChildren, ReactNode } from "react";
import { FirebaseAuthProvider, useFirebaseAuth, type AppUser } from "@/providers/FirebaseAuthProvider";

export type { AppUser };

/** @deprecated Use FirebaseAuthProvider — alias kept so existing imports keep working. */
export const AuthProvider = FirebaseAuthProvider;

export function AuthLoaded({ children }: PropsWithChildren): ReactNode {
  return children;
}

export type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthState & { loading: boolean; onAuthFailure: () => Promise<void> } {
  const a = useFirebaseAuth();
  return {
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
