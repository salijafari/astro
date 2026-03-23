import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { logInPurchases } from "@/lib/purchases";

/**
 * Links RevenueCat customer to the current local auth user id.
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
