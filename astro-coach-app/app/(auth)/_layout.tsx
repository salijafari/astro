import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

/**
 * OAuth (e.g. Google) returns to the same URL as sign-in while Firebase already has a session.
 * Declarative Redirect is more reliable than useEffect alone (no race with router timing on web).
 */
export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useFirebaseAuth();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (user && inAuthGroup) {
      router.replace("/");
    }
  }, [user, loading, segments, router]);

  if (!loading && user) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
