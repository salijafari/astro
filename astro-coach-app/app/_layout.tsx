import "../global.css";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthBridge } from "@/components/AuthBridge";
import { clerkPublishableKey } from "@/lib/clerk";
import { initMixpanel } from "@/lib/mixpanel";
import { configureRevenueCat } from "@/lib/revenuecat";
import { tokenCache } from "@/lib/tokenCache";
import { theme } from "@/constants/theme";

console.log("[startup] app/_layout.tsx module loaded");

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <View className="flex-1 bg-slate-950 px-6 py-10">
      <Text className="mb-3 text-2xl font-semibold text-white">Route crashed</Text>
      <Text className="mb-4 text-slate-300">{props.error.message}</Text>
      <Text className="mb-4 text-xs text-slate-400">{props.error.stack ?? "No stack available."}</Text>
      <Text className="text-sky-300 underline" onPress={props.retry}>
        Tap to retry
      </Text>
    </View>
  );
}

function StartupErrorScreen({ error }: { error: Error }) {
  return (
    <View className="flex-1 bg-slate-950 px-6 py-10">
      <Text className="mb-3 text-2xl font-semibold text-white">Astra Coach could not start</Text>
      <Text className="mb-4 text-slate-300">
        A startup provider failed during initialization. See the details below.
      </Text>
      <Text className="mb-2 text-slate-400">Error</Text>
      <Text className="mb-4 text-red-300">{error.message}</Text>
      <Text className="mb-2 text-slate-400">Stack</Text>
      <Text className="text-xs text-slate-300">{error.stack ?? "No stack available."}</Text>
    </View>
  );
}

function RootProviders({
  onStartupCrash,
}: {
  onStartupCrash: (error: Error) => void;
}) {
  console.log("[startup] RootProviders render begin");

  useEffect(() => {
    console.log("[startup] RootLayout mounted");

    try {
      console.log("[startup] RevenueCat init start");
      void configureRevenueCat()
        .then(() => {
          console.log("[startup] RevenueCat init done");
        })
        .catch((error) => {
          onStartupCrash(error instanceof Error ? error : new Error(String(error)));
        });
    } catch (error) {
      console.error("[startup] RevenueCat init threw in layout", error);
      onStartupCrash(error instanceof Error ? error : new Error(String(error)));
    }

    console.log("[startup] Mixpanel init start");
    void initMixpanel()
      .then(() => {
        console.log("[startup] Mixpanel init done");
      })
      .catch((error) => {
        console.error("[startup] Mixpanel init threw in layout", error);
        onStartupCrash(error instanceof Error ? error : new Error(String(error)));
      });
  }, [onStartupCrash]);

  if (!clerkPublishableKey) {
    console.error("[startup] Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY");
    return (
      <View className="flex-1 items-center justify-center bg-slate-950 px-6">
        <Text className="text-white text-center">
          Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env.local (see .env.example).
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <AuthBridge />
        <GestureHandlerRootView className="flex-1">
          <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.backgroundAlt } }} />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  const [startupError, setStartupError] = useState<Error | null>(null);
  if (startupError) return <StartupErrorScreen error={startupError} />;
  return <RootProviders onStartupCrash={setStartupError} />;
}
