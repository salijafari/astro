import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  PEOPLE_REL_TYPES,
  type PeopleRelationshipType,
  formatDateForApi,
  formatTimeForApi,
  openWebDateTimeInput,
} from "@/lib/peopleProfileForm";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { isPersian } from "@/lib/i18n";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";

export default function AddPersonScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : undefined;
  const { getToken } = useAuth();
  const rtl = isPersian(i18n.language);

  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] = useState<PeopleRelationshipType>("partner");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTime, setBirthTime] = useState<string | null>(null);
  const [birthPlace, setBirthPlace] = useState("");
  const [birthLat, setBirthLat] = useState<number | null>(null);
  const [birthLong, setBirthLong] = useState<number | null>(null);
  const [birthTimezone, setBirthTimezone] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const webDateInputRef = useRef<HTMLInputElement | null>(null);
  const webTimeInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState("");
  const [preds, setPreds] = useState<Array<{ description: string; place_id: string }>>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const formatDate = (d: Date | null) => {
    if (!d) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  };

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
    if (!name.trim()) {
      setError(t("people.addValidationRequired"));
      return;
    }
    if (!birthDate) {
      setError(t("people.addValidationRequired"));
      return;
    }
    const birthDateStr = formatDateForApi(birthDate);
    if (!birthDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
      setError(t("people.addValidationDate"));
      return;
    }

    setSaving(true);
    setError(null);
    setPaywallOpen(false);
    try {
      const timeForApi = formatTimeForApi(birthTime);
      const body: Record<string, unknown> = {
        name: name.trim(),
        relationshipType,
        birthDate: birthDateStr,
      };
      if (timeForApi !== undefined) body.birthTime = timeForApi;
      const placeTrim = birthPlace.trim();
      if (placeTrim) body.birthPlace = placeTrim;
      if (birthLat != null) body.birthLat = birthLat;
      if (birthLong != null) body.birthLong = birthLong;
      if (birthTimezone?.trim()) body.birthTimezone = birthTimezone.trim();

      const res = await apiPostJson<{ success?: boolean; profile?: { id: string } }>("/api/people", getToken, body);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const newId = res.profile?.id;
      if (returnTo === "compatibility" && newId) {
        router.replace(
          `/(main)/feature/romantic-compatibility?autoSelectPersonId=${encodeURIComponent(newId)}` as Href,
        );
      } else {
        router.back();
      }
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

  const webInputColor = tc.textPrimary;
  const webPlaceholderColor = tc.textTertiary;

  return (
    <AuroraSafeArea className="flex-1 pb-6">
      <View className="flex-1 px-4">
        <View className="flex-row items-center justify-between py-3">
          <Pressable
            onPress={() => router.back()}
            className="min-h-[48px] min-w-[48px] justify-center px-2"
            accessibilityRole="button"
            hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <Text className="mb-2 text-sm" style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}>
            {t("people.relationshipLabel")}
          </Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {PEOPLE_REL_TYPES.map((r) => (
              <Pressable
                key={r}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  setRelationshipType(r);
                }}
                className="min-h-[48px] justify-center rounded-[20px] border px-4 py-2"
                style={{
                  borderColor: relationshipType === r ? theme.colors.primary : tc.border,
                  backgroundColor: relationshipType === r ? `${theme.colors.primary}22` : "transparent",
                }}
              >
                <Text style={{ color: tc.textPrimary }}>{t(`people.relationship.${r}`)}</Text>
              </Pressable>
            ))}
          </View>

          <View className="mb-2">
            <Text className="mb-1 ml-1 text-xs" style={{ color: tc.sectionHeading, writingDirection: rtl ? "rtl" : "ltr" }}>
              {t("profileSetup.nameLabel")} *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("people.fieldName")}
              placeholderTextColor={tc.textTertiary}
              className="min-h-[56px] rounded border px-4 text-base"
              style={{
                color: tc.textPrimary,
                borderColor: tc.border,
                backgroundColor: tc.surfacePrimary,
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            />
          </View>

          <View className="mb-2">
            <Text className="mb-1 ml-1 text-xs" style={{ color: tc.sectionHeading, writingDirection: rtl ? "rtl" : "ltr" }}>
              {t("profileSetup.dobLabel")} *
            </Text>
            {Platform.OS === "web" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => openWebDateTimeInput(webDateInputRef.current)}
                className="min-h-[56px] justify-center rounded border px-4"
                style={{
                  borderColor: tc.border,
                  backgroundColor: tc.surfacePrimary,
                  cursor: "pointer",
                }}
              >
                <input
                  ref={webDateInputRef}
                  type="date"
                  value={birthDate ? birthDate.toISOString().split("T")[0] : ""}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (e.target.value) {
                      setBirthDate(new Date(`${e.target.value}T12:00:00`));
                    } else {
                      setBirthDate(null);
                    }
                  }}
                  max={new Date().toISOString().split("T")[0]}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: birthDate ? webInputColor : webPlaceholderColor,
                    fontSize: 16,
                    width: "100%",
                    minHeight: 56,
                    outline: "none",
                    colorScheme: tc.isDark ? "dark" : "light",
                    boxSizing: "border-box",
                    cursor: "pointer",
                  }}
                />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="min-h-[56px] flex-row items-center justify-between rounded border px-4"
                style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
              >
                <Text className="text-base" style={{ color: birthDate ? tc.textPrimary : tc.textTertiary }}>
                  {birthDate ? formatDate(birthDate) : t("profileSetup.dobPlaceholder")}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={tc.iconSecondary} />
              </Pressable>
            )}
          </View>

          <View className="mb-2">
            <View className="mb-1 ml-1 flex-row items-center">
              <Text className="text-xs" style={{ color: tc.sectionHeading }}>
                {t("profileSetup.timeLabel")}
              </Text>
              <Text className="ml-2 text-xs" style={{ color: tc.textTertiary }}>
                {t("profileSetup.optional")}
              </Text>
            </View>
            <View className="flex-row items-center">
              {Platform.OS === "web" ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openWebDateTimeInput(webTimeInputRef.current)}
                  className="min-h-[56px] flex-1 justify-center rounded border px-4"
                  style={{
                    borderColor: tc.border,
                    backgroundColor: tc.surfacePrimary,
                    cursor: "pointer",
                  }}
                >
                  <input
                    ref={webTimeInputRef}
                    type="time"
                    value={birthTime ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBirthTime(e.target.value || null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: birthTime ? webInputColor : webPlaceholderColor,
                      fontSize: 16,
                      width: "100%",
                      minHeight: 56,
                      outline: "none",
                      colorScheme: tc.isDark ? "dark" : "light",
                      boxSizing: "border-box",
                      cursor: "pointer",
                    }}
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  className="min-h-[56px] flex-1 flex-row items-center justify-between rounded border px-4"
                  style={{ borderColor: tc.border, backgroundColor: tc.surfacePrimary }}
                >
                  <Text className="text-base" style={{ color: birthTime ? tc.textPrimary : tc.textTertiary }}>
                    {birthTime ?? t("profileSetup.timePlaceholder")}
                  </Text>
                  <Ionicons name="time-outline" size={18} color={tc.iconSecondary} />
                </Pressable>
              )}
              {birthTime ? (
                <Pressable
                  onPress={() => setBirthTime(null)}
                  accessibilityRole="button"
                  hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
                  className="ml-2 h-10 w-10 items-center justify-center rounded-[20px]"
                >
                  <Ionicons name="close-circle" size={22} color={tc.iconSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("people.fieldCity")}
            placeholderTextColor={tc.textTertiary}
            className="mb-2 min-h-[56px] rounded border px-4 text-base"
            style={{
              color: tc.textPrimary,
              borderColor: tc.border,
              backgroundColor: tc.surfacePrimary,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          />
          {placeLoading ? <ActivityIndicator color={theme.colors.primary} className="mb-2" /> : null}
          {preds.length ? (
            <FlatList
              data={preds}
              keyExtractor={(p) => p.place_id}
              style={{ maxHeight: 160, marginBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void pickPlace(item)}
                  className="min-h-[48px] justify-center border-b border-slate-800 px-4 py-2"
                >
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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {showDatePicker && Platform.OS !== "web" ? (
        <NativeDateTimePicker
          value={birthDate ?? new Date(2000, 0, 1)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_: unknown, date?: Date) => {
            setShowDatePicker(false);
            if (date) setBirthDate(date);
          }}
        />
      ) : null}

      {showTimePicker && Platform.OS !== "web" ? (
        <NativeDateTimePicker
          value={new Date(`2000-01-01T${birthTime ?? "12:00"}:00`)}
          mode="time"
          display="default"
          onChange={(_: unknown, date?: Date) => {
            setShowTimePicker(false);
            if (date) {
              const h = date.getHours().toString().padStart(2, "0");
              const m = date.getMinutes().toString().padStart(2, "0");
              setBirthTime(`${h}:${m}`);
            }
          }}
        />
      ) : null}

      {paywallOpen ? (
        <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} />
      ) : null}
    </AuroraSafeArea>
  );
}
