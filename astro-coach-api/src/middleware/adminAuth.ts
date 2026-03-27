import type { Context, Next } from "hono";
import type { FirebaseAuthContext } from "./firebase-auth.js";
import { requireFirebaseAuth } from "./firebase-auth.js";
import { prisma } from "../lib/prisma.js";

/**
 * Admin auth middleware — chains on top of requireFirebaseAuth.
 *
 * Verifies the Firebase token (via requireFirebaseAuth), then confirms
 * the resolved DB user has `isAdmin = true`.
 *
 * Usage in routes:
 *   adminRouter.use("*", requireAdminAuth);
 */
export async function requireAdminAuth(
  c: Context<FirebaseAuthContext>,
  next: Next
): Promise<Response | void> {
  // First run the standard Firebase auth check
  let authPassed = false;
  await requireFirebaseAuth(c, async () => {
    authPassed = true;
  });

  if (!authPassed) {
    // requireFirebaseAuth already returned a 401/403 response
    return;
  }

  const dbUserId = c.get("dbUserId");
  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return c.json({ error: "Forbidden — admin access required" }, 403);
  }

  await next();
}
