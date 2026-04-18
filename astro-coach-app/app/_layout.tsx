import "../global.css";
import { AuthLoaded, AuthProvider, useAuth } from "@/lib/auth";
import { Stack, useRouter, type ErrorBoundaryProps } from "expo-router";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  useFonts as useDMSansFonts,
} from "@expo-google-fonts/dm-sans";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  useFonts as usePlayfairFonts,
} from "@expo-google-fonts/playfair-display";
import { Vazirmatn_400Regular, Vazirmatn_500Medium, Vazirmatn_600SemiBold, Vazirmatn_700Bold } from "@expo-google-fonts/vazirmatn";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { setupKeyboardFix } from "@/lib/keyboard";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthBridge } from "@/components/AuthBridge";
import i18n, { initializeI18n } from "@/lib/i18n";
import { initMixpanel } from "@/lib/mixpanel";
import { configureRevenueCat } from "@/lib/revenuecat";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { themes, typography } from "@/constants/theme";
import { auroraCanvasBackground } from "@/lib/auroraPalette";
import { requestPermission, setupNotificationHandlers } from "@/lib/notifications";
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://f2927d834d8456d8c23ccc1e12066472@o4511176445788160.ingest.us.sentry.io/4511176455684097',
  enabled: !__DEV__,
  sendDefaultPii: true,
  enableLogs: true,
  tracesSampleRate: 0.2,
});

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

/**
 * Firebase Messaging listeners (native) + FCM token sync after sign-in (native + web).
 */
const PushNotificationBootstrap = () => {
  const router = useRouter();
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (Platform.OS === "web") return;
    try {
      setupNotificationHandlers(router);
    } catch (e) {
      console.warn("[notifications] setup handlers in layout failed", e);
    }
  }, [router]);

  useEffect(() => {
    if (!isSignedIn) return;
    void (async () => {
      try {
        await requestPermission(getToken);
      } catch (e) {
        console.warn("[notifications] FCM registration in layout failed", e);
      }
    })();
  }, [isSignedIn, getToken]);

  return null;
};

function AuthLoadingGate({ children }: { children: ReactNode }) {
  const { loading, isLoaded } = useAuth();
  const { theme, isDark } = useTheme();
  if (!isLoaded || loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: auroraCanvasBackground(isDark) }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }
  return children;
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
  const [playfairLoaded] = usePlayfairFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
  });
  const [dmSansLoaded] = useDMSansFonts({
    DMSans_400Regular,
    DMSans_500Medium,
  });
  const { theme, isDark } = useTheme();
  const themeColors = theme?.colors ?? themes.dark.colors;
  const rootCanvas = auroraCanvasBackground(isDark);

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

  if (!ready || !fontsLoaded || !playfairLoaded || !dmSansLoaded) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: rootCanvas }}>
        <ActivityIndicator color={themeColors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <AuthLoadingGate>
        <AuthLoaded>
          <AuthBridge />
          <PushNotificationBootstrap />
          <GestureHandlerRootView className="flex-1">
            <SafeAreaProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: rootCanvas },
                  animation: "fade",
                  animationDuration: 200,
                  gestureDirection: "horizontal",
                }}
              />
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </AuthLoaded>
      </AuthLoadingGate>
    </AuthProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  const [startupError, setStartupError] = useState<Error | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const cleanup = setupKeyboardFix();
    return cleanup;
  }, []);

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
});
