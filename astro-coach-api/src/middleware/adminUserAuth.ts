import type { Context, Next } from "hono";
import type { FirebaseAuthContext } from "./firebase-auth.js";
import { requireFirebaseAuth } from "./firebase-auth.js";
import { prisma } from "../lib/prisma.js";

/**
 * Admin access: Firebase auth + (row in AdminUser for DB email OR legacy User.isAdmin).
 *
 * AdminUser lookup uses the PostgreSQL User.email field (updated from Firebase on sync).
 * If Firebase and DB emails drift before the next sync, AdminUser may not match until
 * the token carries the same email as stored — DB email is the source of truth for the table.
 */
export async function requireAdminUserAuth(
  c: Context<FirebaseAuthContext>,
  next: Next
): Promise<Response | void> {
  let authPassed = false;
  await requireFirebaseAuth(c, async () => {
    authPassed = true;
  });

  if (!authPassed) {
    return;
  }

  const dbUserId = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    select: { email: true, isAdmin: true },
  });

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const listed = await prisma.adminUser.findUnique({
    where: { email: user.email },
    select: { id: true },
  });

  if (!listed && !user.isAdmin) {
    return c.json({ error: "Forbidden — admin access required" }, 403);
  }

  c.set("adminEmail", user.email);
  await next();
}
