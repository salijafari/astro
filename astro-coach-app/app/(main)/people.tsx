import { useCallback, useState } from "react";
import { useRouter, type Href } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { CosmicBackground } from "@/components/CosmicBackground";
import { MainTabChromeHeader } from "@/components/MainInPageChrome";
import { PeopleScreenRowCard } from "@/components/PeopleScreenRowCard";
import { apiGetJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

type PeopleListRow = {
  id: string;
  name: string;
  relationshipType: string;
  hasFullData: boolean;
  birthDate?: string;
};

function formatListBirthDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PeopleScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme } = useTheme();
  const router = useRouter();
  const { getToken } = useAuth();
  const rtl = i18n.language === "fa";
  const { width: windowWidth } = useWindowDimensions();
  /** Symmetric inset: 16 mobile, 24 tablet, 32 large web — keeps RTL safe. */
  const horizontalPadding = windowWidth >= 900 ? 32 : windowWidth >= 600 ? 24 : 16;

  const [profiles, setProfiles] = useState<PeopleListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetJson<{ profiles: PeopleListRow[] }>("/api/people", getToken);
      setProfiles(res.profiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />
      <View className="flex-1 pb-8" style={{ paddingHorizontal: horizontalPadding }}>
        <MainTabChromeHeader />
        <Text
          className="mt-2 text-3xl font-semibold"
          style={{ color: tc.textPrimary, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t("people.title")}
        </Text>
        <Text
          className="mt-3 text-lg"
          style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t("people.subtitle")}
        </Text>

        <Pressable
          onPress={() => router.push("/(main)/people/add" as Href)}
          className="mt-8 min-h-[80px] items-center rounded-2xl border"
          style={{
            borderColor: tc.border,
            marginBottom: 16,
            flexDirection: rtl ? "row-reverse" : "row",
          }}
        >
          <View
            className="h-20 w-20 items-center justify-center"
            style={{ borderEndWidth: 1, borderEndColor: tc.border }}
          >
            <Text className="text-5xl" style={{ color: tc.textPrimary }}>
              +
            </Text>
          </View>
          <Text
            className="flex-1 px-4 text-3xl font-medium"
            style={{
              color: tc.textPrimary,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("people.addSomeone")}
          </Text>
        </Pressable>

        <PeopleScreenRowCard
          rtl={rtl}
          onPress={() => router.push("/(main)/edit-profile" as Href)}
          leading={<Text className="text-3xl">🪞</Text>}
          title={t("people.you")}
          subtitle={t("people.youSigns")}
        />

        {loading ? (
          <View className="mt-6 items-center">
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error ? (
          <Text className="mt-6 text-base" style={{ color: tc.textSecondary }}>
            {t("people.listError")}: {error}
          </Text>
        ) : profiles.length === 0 ? (
          <Text className="mt-6 text-base" style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}>
            {t("people.listEmpty")}
          </Text>
        ) : (
          <FlatList
            className="flex-1"
            data={profiles}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const rel = t(`people.relationship.${item.relationshipType}`, { defaultValue: item.relationshipType });
              const dob = formatListBirthDate(item.birthDate);
              const subtitle = [rel, dob].filter(Boolean).join(" · ");
              const initial = item.name.trim().charAt(0).toUpperCase() || "?";
              return (
                <PeopleScreenRowCard
                  rtl={rtl}
                  onPress={() =>
                    router.push(`/(main)/edit-person?id=${encodeURIComponent(item.id)}` as Href)
                  }
                  leading={
                    <Text className="text-3xl font-semibold" style={{ color: tc.textPrimary }}>
                      {initial}
                    </Text>
                  }
                  title={item.name}
                  subtitle={subtitle || rel}
                  tertiary={!item.hasFullData ? t("people.partialBirthData") : undefined}
                />
              );
            }}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        )}
      </View>
    </View>
  );
}
