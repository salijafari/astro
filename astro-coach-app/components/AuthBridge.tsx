import { useAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";
import Purchases from "react-native-purchases";

/**
 * Links RevenueCat customer to Clerk user id after sign-in (Section 7).
 */
export const AuthBridge: React.FC = () => {
  const { userId, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && userId) {
      void Purchases.logIn(userId).catch(() => {
        /* Expo Go / missing keys */
      });
    }
  }, [isSignedIn, userId]);

  return null;
};
