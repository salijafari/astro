import { useAuth } from "@clerk/clerk-expo";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { FlatList, Modal, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { apiGetJson, apiPostJson } from "@/lib/api";
import { useSubscriptionStore } from "@/stores/subscriptionStore";

type Profile = { id: string; name: string; synastryScore: number | null };

/**
 * Compatibility profiles + paywalled full report.
 */
export default function CompatibilityScreen() {
  const { getToken } = useAuth();
  const status = useSubscriptionStore((s) => s.status);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [modal, setModal] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [name, setName] = useState("");
  const [report, setReport] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await apiGetJson<{ profiles: Profile[] }>("/api/compatibility/profiles", getToken);
      setProfiles(res.profiles ?? []);
    } catch {
      /* ignore */
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const addPerson = async () => {
    if (!name.trim()) return;
    try {
      const st = await apiPostJson<{ id: string; synastryScore: number }>(
        "/api/compatibility/profile",
        getToken,
        {
          name: name.trim(),
          relationship: "Friend",
          birthDate: "1995-06-15",
          birthTime: "12:00",
          birthCity: "Sample",
          birthLat: 40.7,
          birthLong: -74,
          birthTimezone: "America/New_York",
        },
      );
      setProfiles((p) => [...p, { id: st.id, name: name.trim(), synastryScore: st.synastryScore }]);
      setName("");
      setModal(false);
    } catch {
      /* ignore */
    }
  };

  const openReport = async (id: string) => {
    if (status !== "active" && status !== "trial") {
      setPaywall(true);
      return;
    }
    try {
      const r = await apiPostJson<{ report: { overall?: string } }>(
        "/api/compatibility/report",
        getToken,
        { profileId: id },
      );
      setReport(r.report?.overall ?? JSON.stringify(r.report));
    } catch {
      setReport("Could not load report.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <Text className="text-white text-2xl font-bold px-4 pt-4">Compatibility</Text>
      <Button title="Add person" onPress={() => setModal(true)} />
      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text className="text-slate-500">Add someone you care about.</Text>}
        renderItem={({ item }) => (
          <View className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3">
            <Text className="text-white text-lg font-semibold">{item.name}</Text>
            <Text className="text-indigo-300">Score: {item.synastryScore ?? "—"}</Text>
            <Button title="See full report" onPress={() => void openReport(item.id)} />
          </View>
        )}
      />

      <Modal visible={modal} animationType="slide">
        <SafeAreaView className="flex-1 bg-slate-950 px-4">
          <Text className="text-white text-xl mt-4">New person (demo birth data)</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#64748b"
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white mt-4"
          />
          <Button title="Save" onPress={() => void addPerson()} />
          <Button title="Close" variant="ghost" onPress={() => setModal(false)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={paywall} animationType="slide">
        <PaywallScreen
          context="compatibility"
          onContinueFree={() => setPaywall(false)}
          onSubscribed={() => setPaywall(false)}
        />
      </Modal>

      {report ? (
        <View className="px-4 pb-8">
          <Text className="text-slate-200">{report}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
