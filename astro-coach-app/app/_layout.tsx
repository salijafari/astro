import "../global.css";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useFonts } from "expo-font";
import { Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold } from "@expo-google-fonts/vazirmatn";
import { useEffect, useState } from "react";
import { ActivityIndicator, I18nManager, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthBridge } from "@/components/AuthBridge";
import { clerkPublishableKey } from "@/lib/clerk";
import { initializeI18n } from "@/lib/i18n";
import { initMixpanel } from "@/lib/mixpanel";
import { configureRevenueCat } from "@/lib/revenuecat";
import { tokenCache } from "@/lib/tokenCache";
import i18n from "@/lib/i18n";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { themes, typography } from "@/constants/theme";

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const c = themes.dark.colors;
  return (
    <View className="flex-1 px-6 py-10" style={{ backgroundColor: c.background }}>
      <Text className="mb-3 text-2xl font-semibold" style={{ color: c.onBackground }}>
        {i18n.t("errors.routeCrashed")}
      </Text>
      <Text className="mb-4" style={{ color: c.onSurfaceVariant }}>{props.error.message}</Text>
      <Text className="mb-4 text-xs" style={{ color: c.onSurfaceVariant }}>
        {props.error.stack ?? i18n.t("errors.noStack")}
      </Text>
      <Text className="underline" style={{ color: c.primary }} onPress={props.retry}>
        {i18n.t("errors.retry")}
      </Text>
    </View>
  );
}

function StartupErrorScreen({ error }: { error: Error }) {
  const c = themes.dark.colors;
  return (
    <View className="flex-1 px-6 py-10" style={{ backgroundColor: c.background }}>
      <Text className="mb-3 text-2xl font-semibold" style={{ color: c.onBackground }}>
        {i18n.t("errors.startupFailed")}
      </Text>
      <Text className="mb-4" style={{ color: c.onSurfaceVariant }}>{error.message}</Text>
      <Text className="text-xs" style={{ color: c.onSurfaceVariant }}>{error.stack ?? i18n.t("errors.noStack")}</Text>
    </View>
  );
}

function RootProviders({
  onStartupCrash,
}: {
  onStartupCrash: (error: Error) => void;
}) {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    [typography.family.regular]: Vazirmatn_400Regular,
    [typography.family.medium]: Vazirmatn_500Medium,
    [typography.family.semibold]: Vazirmatn_600SemiBold,
    [typography.family.bold]: Vazirmatn_700Bold,
  });
  const { theme } = useTheme();

  useEffect(() => {
    void (async () => {
      try {
        await initializeI18n();
        setReady(true);
      } catch (error) {
        onStartupCrash(error instanceof Error ? error : new Error(String(error)));
      }
    })();
  }, [onStartupCrash]);

  useEffect(() => {
    if (!ready) return;
    try {
      void configureRevenueCat()
        .catch((error) => {
          onStartupCrash(error instanceof Error ? error : new Error(String(error)));
        });
    } catch (error) {
      console.error("[startup] RevenueCat init threw in layout", error);
      onStartupCrash(error instanceof Error ? error : new Error(String(error)));
    }
    void initMixpanel()
      .catch((error) => {
        console.error("[startup] Mixpanel init threw in layout", error);
        onStartupCrash(error instanceof Error ? error : new Error(String(error)));
      });
  }, [ready, onStartupCrash]);

  if (!ready || !fontsLoaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!clerkPublishableKey) {
    return (
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: theme.colors.background }}>
        <Text className="text-center" style={{ color: theme.colors.onBackground }}>{i18n.t("errors.clerkMissingKey")}</Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <AuthBridge />
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.background },
                animation: "fade",
                animationDuration: 200,
                gestureDirection: "horizontal",
              }}
            />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  const [startupError, setStartupError] = useState<Error | null>(null);
  if (startupError) {
    return (
      <ThemeProvider>
        <StartupErrorScreen error={startupError} />
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider>
      <RootProviders onStartupCrash={setStartupError} />
    </ThemeProvider>
  );
}
