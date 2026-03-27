import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";
import { apiRequest } from "@/lib/api";

/**
 * Admin layout — guards the entire (admin) route group.
 *
 * On mount, calls /api/admin/health to verify the logged-in user has admin rights.
 * If the check fails (403 or not signed in), redirects to the main app.
 */
const AdminLayout: React.FC = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.replace("/(auth)/sign-in");
      return;
    }

    const verifyAdmin = async () => {
      try {
        const res = await apiRequest("/api/admin/health", { method: "GET", getToken });
        if (!res.ok) {
          router.replace("/(main)/home");
        }
      } catch {
        router.replace("/(main)/home");
      } finally {
        setChecking(false);
      }
    };

    verifyAdmin();
  }, [isLoaded, isSignedIn, getToken, router]);

  if (!isLoaded || checking) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.onBackground,
        headerTitleStyle: { fontFamily: "Vazirmatn_600SemiBold" },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="content" options={{ title: "Content Manager" }} />
      <Stack.Screen name="prompts" options={{ title: "Prompt Templates" }} />
      <Stack.Screen name="safety" options={{ title: "Safety Responses" }} />
      <Stack.Screen name="stats" options={{ title: "Usage Stats" }} />
    </Stack>
  );
};

export default AdminLayout;
