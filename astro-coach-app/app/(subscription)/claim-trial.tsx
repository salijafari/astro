import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";

/**
 * Trial starts automatically on the server. Deep links to this route redirect home.
 */
export default function ClaimTrialScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(main)/home");
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color="#7c3aed" />
    </View>
  );
}
