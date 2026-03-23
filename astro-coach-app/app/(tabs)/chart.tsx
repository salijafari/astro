import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetJson } from "@/lib/api";

type Row = { planet: string; sign: string; house: number; degree: number };

/**
 * Cached natal table from `/api/chart/natal`.
 */
export default function ChartScreen() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [interp, setInterp] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetJson<{ natalChartJson: { planets?: Row[] } }>("/api/chart/natal", getToken);
      setRows(res.natalChartJson.planets ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPlanetTap = async (planet: string) => {
    if (interp[planet]) return;
    try {
      const r = await apiGetJson<{ interpretation: string }>(`/api/chart/interpret/${encodeURIComponent(planet)}`, getToken);
      setInterp((m) => ({ ...m, [planet]: r.interpretation }));
    } catch {
      setInterp((m) => ({ ...m, [planet]: "Could not load interpretation." }));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top"]}>
      <Text className="text-white text-2xl font-bold px-4 pt-4">Birth chart</Text>
      <Text className="text-slate-500 px-4 text-sm">Tap a planet for a short reading.</Text>
      {loading ? <ActivityIndicator color="#a5b4fc" className="mt-8" /> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.planet}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => void onPlanetTap(item.planet)} className="mb-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <Text className="text-white font-semibold">
              {item.planet} · {item.sign}
              {item.house ? ` · House ${item.house}` : ""} · {item.degree.toFixed(1)}°
            </Text>
            {interp[item.planet] ? <Text className="text-slate-300 mt-2">{interp[item.planet]}</Text> : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
