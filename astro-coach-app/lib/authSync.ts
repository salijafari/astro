import { Platform } from "react-native";
import { getFirebaseAuth } from "@/lib/firebase";

const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

type SyncableUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
  email?: string | null;
  displayName?: string | null;
};

/**
 * POST /api/auth/sync so Railway has a `User` row before protected routes run.
 * Pass the signed-in `User` from sign-in/register when available; otherwise reads `currentUser`.
 */
export async function syncAuthUserToBackend(explicitUser?: SyncableUser | null): Promise<void> {
  const u = explicitUser ?? (await getFirebaseSessionUser());
  if (!u) {
    throw new Error("No Firebase user");
  }
  const token = await u.getIdToken();
  const res = await fetch(`${base}/api/auth/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // Do not send displayName/firstName — server must not overwrite PostgreSQL `User.name` on sync.
    body: JSON.stringify({
      email: u.email ?? undefined,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `sync failed (${res.status})`);
  }
}

async function getFirebaseSessionUser(): Promise<SyncableUser | null> {
  if (Platform.OS === "web") {
    const auth = getFirebaseAuth() as import("firebase/auth").Auth;
    return auth.currentUser;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
  return nativeAuth().currentUser;
}
