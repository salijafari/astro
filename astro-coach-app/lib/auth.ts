import { type PropsWithChildren, type ReactNode } from "react";

type AuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

type SignInResult = {
  createdSessionId: string;
};

type UseSignInState = {
  isLoaded: boolean;
  signIn: {
    create: (_args: { identifier: string; password: string }) => Promise<SignInResult>;
  };
  setActive: (_args: { session: string }) => Promise<void>;
};

type UseOAuthState = {
  startOAuthFlow: (_args: { redirectUrl: string }) => Promise<{
    createdSessionId: string;
    setActive: (_args: { session: string }) => Promise<void>;
  }>;
};

const LOCAL_USER_ID = "local-preview-user";

const noopAsync = async () => {};

/**
 * Temporary local auth shim until Auth0 integration is added.
 * App behaves as signed in and never blocks on auth.
 */
export function useAuth(): AuthState {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: LOCAL_USER_ID,
    getToken: async () => null,
    signOut: noopAsync,
  };
}

export function useSignIn(): UseSignInState {
  return {
    isLoaded: true,
    signIn: {
      create: async () => ({ createdSessionId: "local-session" }),
    },
    setActive: noopAsync,
  };
}

export function useOAuth(_options?: { strategy?: string }): UseOAuthState {
  return {
    startOAuthFlow: async () => ({
      createdSessionId: "local-session",
      setActive: noopAsync,
    }),
  };
}

export function AuthProvider({ children }: PropsWithChildren): ReactNode {
  return children;
}

export function AuthLoaded({ children }: PropsWithChildren): ReactNode {
  return children;
}
