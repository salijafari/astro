/**
 * Populated by FirebaseAuthProvider so api.ts can refresh tokens and sign out on 401 without threading through every call site.
 */
export const authApiRef: {
  refreshToken?: () => Promise<string | null>;
  onAuthFailure?: () => Promise<void>;
} = {};
