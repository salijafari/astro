import { useAuth } from "@/lib/auth";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { apiGetJson } from "@/lib/api";
import { readPersistedValue } from "@/lib/storage";
import { ONBOARDING_LANG_SELECTED_KEY } from "@/lib/i18n";
import { isOnboardingCompletedLocally } from "@/lib/onboardingState";
import { useTheme } from "@/providers/ThemeProvider";

type Me = {
  onboardingComplete: boolean;
};

/**
 * Routes signed-out users to auth, incomplete onboarding to the flow, else tabs.
 */
export default function Index() {
  const { isLoaded, user, getToken } = useAuth();
  const isSignedIn = !!user;
  const { theme } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState(false);
  const [languageSelected, setLanguageSelected] = useState<boolean | null>(null);
  const [localOnboardingComplete, setLocalOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const selected = await readPersistedValue(ONBOARDING_LANG_SELECTED_KEY);
      setLanguageSelected(selected === "1");
      setLocalOnboardingComplete(await isOnboardingCompletedLocally());
    })();
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setMe(null);
      setErr(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    void (async () => {
      try {
        await syncAuthUserToBackend();
        const m = await apiGetJson<Me>("/api/user/me", getToken);
        setMe(m);
      } catch {
        setErr(true);
      }
    })();
  }, [isSignedIn, getToken]);

  if (!isLoaded || languageSelected === null || localOnboardingComplete === null) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!languageSelected) return <Redirect href="/(onboarding)/language-select" />;

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!me && !err) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (err) {
    return localOnboardingComplete ? <Redirect href="/(main)/home" /> : <Redirect href="/(onboarding)/get-set-up" />;
  }

  if (!me?.onboardingComplete) {
    return <Redirect href="/(onboarding)/get-set-up" />;
  }

  return <Redirect href="/(main)/home" />;
}
