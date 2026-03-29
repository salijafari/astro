import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Stripe redirects here when the user cancels out of the checkout page:
 * https://app.akhtar.today/subscription/cancelled
 *
 * The user's trial is still valid — this is not an error state.
 * Let them return to the app to retry later.
 */
export default function SubscriptionCancelledScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <SafeAreaView
      className="flex-1 items-center justify-center px-6"
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text style={{ fontSize: 64 }}>🌙</Text>
      <Text
        className="mt-8 text-center text-4xl font-semibold"
        style={{ color: theme.colors.onBackground }}
      >
        No problem!
      </Text>
      <Text
        className="mt-4 text-center text-xl leading-8"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Your trial is still active
      </Text>

      <Pressable
        onPress={() => router.replace("/(main)/home")}
        className="mt-10 min-h-[52px] justify-center rounded-full px-8 py-4"
        style={{ backgroundColor: theme.colors.onBackground }}
      >
        <Text
          className="text-center text-xl font-semibold"
          style={{ color: theme.colors.background }}
        >
          Return to App
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
