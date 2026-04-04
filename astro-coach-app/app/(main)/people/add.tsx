import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { Button } from "@/components/ui/Button";
import { apiPostJson, apiGetJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

const REL_TYPES = ["partner", "friend", "family", "coworker", "other"] as const;
type RelationshipType = (typeof REL_TYPES)[number];

export default function AddPersonScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme } = useTheme();
  const router = useRouter();
  const { getToken } = useAuth();
  const rtl = i18n.language === "fa";

  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("partner");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState<string | null>(null);
  const [birthPlace, setBirthPlace] = useState("");
  const [birthLat, setBirthLat] = useState<number | null>(null);
  const [birthLong, setBirthLong] = useState<number | null>(null);
  const [birthTimezone, setBirthTimezone] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [preds, setPreds] = useState<Array<{ description: string; place_id: string }>>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setError(null);
    }, []),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (q.length < 2) {
      setPreds([]);
      return;
    }
    setPlaceLoading(true);
    timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await apiGetJson<{ predictions: Array<{ description: string; place_id: string }> }>(
            `/api/places/autocomplete?q=${encodeURIComponent(q)}`,
            getToken,
          );
          setPreds(res.predictions ?? []);
        } catch {
          setPreds([]);
        } finally {
          setPlaceLoading(false);
        }
      })();
    }, 350);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [q, getToken]);

  const pickPlace = async (p: { place_id: string; description: string }) => {
    setPlaceLoading(true);
    try {
      const d = await apiGetJson<{ birthCity: string; birthLat: number; birthLong: number; birthTimezone: string }>(
        `/api/places/details?place_id=${encodeURIComponent(p.place_id)}`,
        getToken,
      );
      setBirthPlace(d.birthCity);
      setBirthLat(d.birthLat);
      setBirthLong(d.birthLong);
      setBirthTimezone(d.birthTimezone);
    } finally {
      setPlaceLoading(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !birthDate.trim()) {
      setError(t("people.addValidationRequired"));
      return;
    }
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim());
    if (!dateOk) {
      setError(t("people.addValidationDate"));
      return;
    }
    setSaving(true);
    setError(null);
    setPaywallOpen(false);
    try {
      await apiPostJson("/api/people", getToken, {
        name: name.trim(),
        relationshipType,
        birthDate: birthDate.trim(),
        birthTime: birthTime?.trim() ? birthTime.trim() : null,
        birthPlace: birthPlace.trim() || null,
        birthLat,
        birthLong,
        birthTimezone,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("people_limit")) {
        setPaywallOpen(true);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuroraSafeArea className="flex-1 px-4 pb-6">
      <View className="flex-row items-center justify-between py-3">
        <Pressable
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] justify-center px-2"
          accessibilityRole="button"
          hitSlop={10}
        >
          <Text className="text-base" style={{ color: tc.textSecondary }}>
            {t("common.back")}
          </Text>
        </Pressable>
        <Text
          className="flex-1 text-center text-lg font-semibold"
          style={{ color: tc.textPrimary, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t("people.addScreenTitle")}
        </Text>
        <View className="w-16" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <Text className="mb-2 text-sm" style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}>
          {t("people.relationshipLabel")}
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {REL_TYPES.map((r) => (
            <Pressable
              key={r}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                setRelationshipType(r);
              }}
              className="min-h-[44px] justify-center rounded-2xl border px-4 py-2"
              style={{
                borderColor: relationshipType === r ? theme.colors.primary : tc.border,
                backgroundColor: relationshipType === r ? `${theme.colors.primary}22` : "transparent",
              }}
            >
              <Text style={{ color: tc.textPrimary }}>{t(`people.relationship.${r}`)}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("people.fieldName")}
          placeholderTextColor="#64748b"
          className="mb-3 rounded-2xl border px-4 py-3"
          style={{ color: tc.textPrimary, borderColor: tc.border, writingDirection: rtl ? "rtl" : "ltr" }}
        />
        <TextInput
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder={t("people.fieldBirthDate")}
          placeholderTextColor="#64748b"
          className="mb-3 rounded-2xl border px-4 py-3"
          style={{ color: tc.textPrimary, borderColor: tc.border, writingDirection: rtl ? "rtl" : "ltr" }}
        />
        <TextInput
          value={birthTime ?? ""}
          onChangeText={(v) => setBirthTime(v ? v : null)}
          placeholder={t("people.fieldBirthTime")}
          placeholderTextColor="#64748b"
          className="mb-3 rounded-2xl border px-4 py-3"
          style={{ color: tc.textPrimary, borderColor: tc.border, writingDirection: rtl ? "rtl" : "ltr" }}
        />

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("people.fieldCity")}
          placeholderTextColor="#64748b"
          className="mb-2 rounded-2xl border px-4 py-3"
          style={{ color: tc.textPrimary, borderColor: tc.border, writingDirection: rtl ? "rtl" : "ltr" }}
        />
        {placeLoading ? <ActivityIndicator color={theme.colors.primary} className="mb-2" /> : null}
        {preds.length ? (
          <FlatList
            data={preds}
            keyExtractor={(p) => p.place_id}
            style={{ maxHeight: 160, marginBottom: 12 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable onPress={() => void pickPlace(item)} className="border-b border-slate-800 py-3">
                <Text style={{ color: tc.textPrimary }}>{item.description}</Text>
              </Pressable>
            )}
          />
        ) : null}

        {birthPlace ? (
          <Text className="mb-4 text-sm" style={{ color: theme.colors.primary }}>
            {t("people.selectedCity", { city: birthPlace })}
          </Text>
        ) : null}

        {error ? (
          <Text className="mb-3 text-sm" style={{ color: tc.textSecondary }}>
            {error}
          </Text>
        ) : null}

        <Button title={saving ? t("people.saving") : t("people.savePerson")} onPress={() => void submit()} disabled={saving} />
      </KeyboardAvoidingView>

      {paywallOpen ? (
        <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} />
      ) : null}
    </AuroraSafeArea>
  );
}
