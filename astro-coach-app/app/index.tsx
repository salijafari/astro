import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { apiGetJson } from "@/lib/api";

type Me = {
  onboardingComplete: boolean;
};

/**
 * Routes signed-out users to auth, incomplete onboarding to the flow, else tabs.
 */
export default function Index() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    void (async () => {
      try {
        const m = await apiGetJson<Me>("/api/user/me", getToken);
        setMe(m);
      } catch {
        setErr(true);
      }
    })();
  }, [isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#a5b4fc" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!me && !err) {
    return (
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#a5b4fc" />
      </View>
    );
  }

  if (err || !me?.onboardingComplete) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
