import { createClerkClient, verifyToken } from "@clerk/backend";

const secretKey = process.env.CLERK_SECRET_KEY ?? "";

/**
 * Verifies a Clerk session JWT and returns the payload (includes `sub`).
 */
export async function verifyClerkBearer(token: string) {
  const r = await verifyToken(token, { secretKey });
  const data = r.data as { sub?: string } | undefined;
  if (data?.sub) return data as { sub: string };
  throw new Error("Invalid Clerk token");
}

/**
 * Clerk REST client for loading user email/name when creating local User rows.
 */
export const clerkClient = createClerkClient({ secretKey });
