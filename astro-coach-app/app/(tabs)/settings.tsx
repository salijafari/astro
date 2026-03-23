import { useAuth } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as Tracking from "expo-tracking-transparency";
import { useEffect, useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import { Button } from "@/components/ui/Button";
import { apiGetJson, apiRequest } from "@/lib/api";

/**
 * Settings: restore purchases, data export, account deletion, ATT (Mixpanel).
 */
export default function SettingsScreen() {
  const { getToken, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Tracking.requestTrackingPermissionsAsync();
  }, []);

  const restore = async () => {
    try {
      await Purchases.restorePurchases();
      Alert.alert("Restore complete");
    } catch {
      Alert.alert("Restore failed");
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await apiGetJson<unknown>("/api/user/export", getToken);
      await Share.share({ message: JSON.stringify(data, null, 2), title: "Astra Coach export" });
    } catch {
      Alert.alert("Export failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This removes your data from our servers (PIPEDA). You will still need to sign out of Clerk.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void doDelete(),
        },
      ],
    );
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await apiRequest("/api/user/account", { method: "DELETE", getToken });
      if (res.ok) {
        await signOut();
        router.replace("/(auth)/sign-in");
      } else Alert.alert("Deletion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-4" edges={["top"]}>
      <Text className="text-white text-2xl font-bold pt-4">Settings</Text>
      <View className="gap-3 mt-6">
        <Button title="Restore purchases" variant="secondary" onPress={() => void restore()} />
        <Button title="Export my data" onPress={() => void exportData()} />
        <Button title="Privacy policy" variant="ghost" onPress={() => void Linking.openURL("https://example.com/privacy")} />
        <Button title="Support" variant="ghost" onPress={() => void Linking.openURL("mailto:support@example.com")} />
        <Button title="Delete account" variant="secondary" onPress={deleteAccount} />
      </View>
      {busy ? <Text className="text-slate-500 mt-4">Working…</Text> : null}
    </SafeAreaView>
  );
}
