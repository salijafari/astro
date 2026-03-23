import { useAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";
import { logInPurchases } from "@/lib/purchases";

/**
 * Links RevenueCat customer to Clerk user id after sign-in (Section 7).
 */
export const AuthBridge: React.FC = () => {
  const { userId, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      void logInPurchases(userId).catch((error) => {
        console.warn("[startup] RevenueCat login skipped", error);
      });
    }
  }, [isSignedIn, userId]);

  return null;
};
