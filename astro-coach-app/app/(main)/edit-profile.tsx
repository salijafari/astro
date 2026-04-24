import { Ionicons } from "@expo/vector-icons";
import { CitySearchInput } from "@/components/CitySearchInput";
import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { FONT, FONT_SIZE, SPACE } from "@/constants";
import { useAuth } from "@/lib/auth";
import { isPersian } from "@/lib/i18n";
import { apiRequest } from "@/lib/api";
import { useThemeColors } from "@/lib/themeColors";
import { fetchUserProfile, invalidateProfileCache } from "@/lib/userProfile";
import { useTheme } from "@/providers/ThemeProvider";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { AuroraSafeArea } from "@/components/CosmicBackground";

/**
 * Standalone profile editor inside Settings — completely decoupled from onboarding.
 * Never touches onboardingComplete, trialStartedAt, or subscription state.
 */
export default function EditProfileScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const { getToken } = useAuth();
  const router = useRouter();
  const rtl = isPersian(i18n.language);

  const [name, setName] = useState("");
  const [nameFa, setNameFa] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(new Date());
  const [birthTime, setBirthTime] = useState<string | null>("12:00");
  const [birthCity, setBirthCity] = useState<string | null>(null);
  const [birthLat, setBirthLat] = useState<number | null>(null);
  const [birthLong, setBirthLong] = useState<number | null>(null);
  const [birthTimezone, setBirthTimezone] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  const loadProfileFromServer = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await invalidateProfileCache();
      const profile = await fetchUserProfile(token, true);
      const loadedName = profile.user?.name ?? profile.user?.firstName ?? "";
      setName(loadedName);
      setNameFa(profile.user?.nameFa?.trim() ?? "");
      if (profile.birthProfile?.birthDate) {
        setBirthDate(new Date(profile.birthProfile.birthDate));
      }
      setBirthTime(profile.birthProfile?.birthTime ?? null);
      setBirthCity(profile.birthProfile?.birthCity ?? null);
      setBirthLat(profile.birthProfile?.birthLat ?? null);
      setBirthLong(profile.birthProfile?.birthLong ?? null);
      setBirthTimezone(profile.birthProfile?.birthTimezone ?? null);
    } catch (err) {
      console.error("[edit-profile] load error:", err);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [getToken]);

  /** Refetch whenever this screen is focused so we never show stale name after save or cache. */
  useFocusEffect(
    useCallback(() => {
      void loadProfileFromServer(!hasLoadedOnceRef.current);
    }, [loadProfileFromServer]),
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("editProfile.nameRequired"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const body: Record<string, unknown> = {
        name: name.trim(),
        ...(isPersian(i18n.language) ? { nameFa: nameFa.trim() || null } : {}),
      };
      if (birthDate) {
        body.birthDate = birthDate.toISOString().split("T")[0];
      }
      if (birthTime !== undefined) body.birthTime = birthTime;
      if (birthCity) {
        body.birthCity = birthCity;
        if (birthLat != null) body.birthLat = birthLat;
        if (birthLong != null) body.birthLong = birthLong;
        if (birthTimezone != null) body.birthTimezone = birthTimezone;
      }

      const res = await apiRequest("/api/user/profile", {
        method: "PUT",
        getToken,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Error: ${res.status}`);
      }

      await invalidateProfileCache();
      const freshToken = await getToken();
      if (freshToken) {
        try {
          await fetchUserProfile(freshToken, true);
        } catch {
          /* non-critical — next focus will refetch */
        }
      }
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[edit-profile] save error:", msg);
      setError(msg);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return t("editProfile.notSet");
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time: string | null): string => {
    if (!time) return t("editProfile.tapToAdd");
    const [h, m] = time.split(":");
    const hr = parseInt(h ?? "0", 10);
    const suffix = hr >= 12 ? "PM" : "AM";
    const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${hr12}:${m ?? "00"} ${suffix}`;
  };

  if (loading) {
    return (
      <AuroraSafeArea edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </AuroraSafeArea>
    );
  }

  /** Name only — birth date is optional (user may save name without a stored DOB). */
  const canSave = !saving && !!name.trim();
  const dividerColor = theme.colors.outlineVariant;

  return (
    <AuroraSafeArea edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: dividerColor,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 }}
        >
          <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: theme.colors.onBackground,
            fontSize: 17,
            fontWeight: "600",
            marginRight: 28,
          }}
        >
          {t("editProfile.title")}
        </Text>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {error ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              backgroundColor: `${theme.colors.error}22`,
              borderWidth: 1,
              borderColor: `${theme.colors.error}44`,
            }}
          >
            <Text style={{ color: theme.colors.error, fontSize: 14, textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 24 }}>
          {/* Name */}
          <FieldRow
            label={t("editProfile.name")}
            value={name || t("editProfile.notSet")}
            hasValue={!!name}
            onPress={() => setShowNameInput(true)}
            dividerColor={dividerColor}
            theme={theme}
            rtl={rtl}
          />

          {isPersian(i18n.language) ? (
            <View style={{ marginTop: 16, paddingHorizontal: 16 }}>
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 13,
                  marginBottom: 6,
                  textAlign: "right",
                }}
              >
                {t("profile.nameFaLabel")}
              </Text>
              <TextInput
                value={nameFa}
                onChangeText={setNameFa}
                placeholder={t("profile.nameFaPlaceholder")}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                maxLength={80}
                style={{
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.onBackground,
                  borderRadius: 4,
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  minHeight: 56,
                  fontSize: 16,
                  marginBottom: 8,
                  textAlign: "right",
                  writingDirection: "rtl",
                }}
              />
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 4, textAlign: "right" }}>
                {t("profile.nameFaHint")}
              </Text>
            </View>
          ) : null}

          {/* Date of Birth */}
          <FieldRow
            label={t("editProfile.dateOfBirth")}
            value={formatDate(birthDate)}
            hasValue={!!birthDate}
            onPress={() => setShowDatePicker(true)}
            dividerColor={dividerColor}
            theme={theme}
            rtl={rtl}
          />

          {/* Birth Time (optional, clearable) */}
          <FieldRow
            label={t("editProfile.birthTime")}
            value={formatTime(birthTime)}
            hasValue={!!birthTime}
            onPress={() => setShowTimePicker(true)}
            dividerColor={dividerColor}
            theme={theme}
            rtl={rtl}
            clearable={!!birthTime}
            onClear={() => setBirthTime(null)}
          />

          {/* Birth Location (optional, searchable) */}
          <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: FONT.sansMedium,
                fontSize: FONT_SIZE.metadata,
                color: tc.textTertiary,
                marginBottom: SPACE[2],
                textAlign: rtl ? "right" : "left",
              }}
            >
              {t("editProfile.birthLocation")}
            </Text>
            <CitySearchInput
              value={birthCity ?? ""}
              onSelect={(city) => {
                setBirthCity(city.displayName);
                setBirthLat(city.lat);
                setBirthLong(city.lng);
                setBirthTimezone(city.timezone);
              }}
              onClear={() => {
                setBirthCity(null);
                setBirthLat(null);
                setBirthLong(null);
                setBirthTimezone(null);
              }}
              getToken={getToken}
              theme={tc}
              rtl={rtl}
              placeholder={t("editProfile.tapToAdd")}
            />
          </View>
        </View>

        {/* Save */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Pressable
            onPress={() => void handleSave()}
            disabled={!canSave}
            style={{
              minHeight: 48,
              justifyContent: "center",
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 20,
              alignItems: "center",
              backgroundColor: canSave ? theme.colors.primary : theme.colors.surfaceVariant,
            }}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text
                style={{
                  color: canSave ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                  fontWeight: "500",
                  fontSize: 14,
                  letterSpacing: 0.1,
                }}
              >
                {t("editProfile.save")}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Name input modal */}
      <BottomSheet visible={showNameInput} onClose={() => setShowNameInput(false)} theme={theme}>
        <Text style={{ color: theme.colors.onBackground, fontWeight: "600", fontSize: 18, marginBottom: 16 }}>
          {t("editProfile.name")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("editProfile.namePlaceholder")}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={{
            backgroundColor: theme.colors.surfaceVariant,
            color: theme.colors.onBackground,
            borderRadius: 4,
            paddingHorizontal: 16,
            paddingVertical: 16,
            minHeight: 56,
            fontSize: 16,
            marginBottom: 16,
            textAlign: rtl ? "right" : "left",
            writingDirection: rtl ? "rtl" : "ltr",
          }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => {
            if (name.trim()) setShowNameInput(false);
          }}
        />
        <SheetDoneButton
          label={t("common.done")}
          onPress={() => {
            if (name.trim()) setShowNameInput(false);
          }}
          theme={theme}
        />
      </BottomSheet>

      {/* Date picker */}
      {showDatePicker &&
        (Platform.OS === "web" ? (
          <BottomSheet visible={showDatePicker} onClose={() => setShowDatePicker(false)} theme={theme}>
            <Text style={{ color: theme.colors.onBackground, fontWeight: "600", fontSize: 18, marginBottom: 16 }}>
              {t("editProfile.dateOfBirth")}
            </Text>
            <input
              ref={dateInputRef}
              type="date"
              autoFocus
              value={birthDate ? birthDate.toISOString().split("T")[0] : ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const d = new Date(e.target.value + "T00:00:00");
                if (!isNaN(d.getTime())) setBirthDate(d);
              }}
              onFocus={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker();
                } catch {
                  /* not supported */
                }
              }}
              style={{
                background: theme.colors.surfaceVariant,
                color: theme.colors.onBackground,
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 16,
                width: "100%",
                marginBottom: 16,
                boxSizing: "border-box",
                colorScheme: "dark",
              }}
            />
            <SheetDoneButton label={t("common.done")} onPress={() => setShowDatePicker(false)} theme={theme} />
          </BottomSheet>
        ) : (
          <NativeDateTimePicker
            value={birthDate ?? new Date()}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            onChange={(_: unknown, date?: Date) => {
              setShowDatePicker(false);
              if (date) setBirthDate(date);
            }}
          />
        ))}

      {/* Time picker */}
      {showTimePicker &&
        (Platform.OS === "web" ? (
          <BottomSheet visible={showTimePicker} onClose={() => setShowTimePicker(false)} theme={theme}>
            <Text style={{ color: theme.colors.onBackground, fontWeight: "600", fontSize: 18, marginBottom: 16 }}>
              {t("editProfile.birthTime")}
            </Text>
            <input
              ref={timeInputRef}
              type="time"
              autoFocus
              value={birthTime ?? "12:00"}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setBirthTime(e.target.value || null);
              }}
              onFocus={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker();
                } catch {
                  /* not supported */
                }
              }}
              style={{
                background: theme.colors.surfaceVariant,
                color: theme.colors.onBackground,
                border: "none",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 16,
                width: "100%",
                marginBottom: 16,
                boxSizing: "border-box",
                colorScheme: "dark",
              }}
            />
            <SheetDoneButton label={t("common.done")} onPress={() => setShowTimePicker(false)} theme={theme} />
          </BottomSheet>
        ) : (
          <NativeDateTimePicker
            value={new Date(`2000-01-01T${birthTime ?? "12:00"}:00`)}
            mode="time"
            display="spinner"
            onChange={(_: unknown, date?: Date) => {
              setShowTimePicker(false);
              if (date) {
                const hours = date.getHours().toString().padStart(2, "0");
                const mins = date.getMinutes().toString().padStart(2, "0");
                setBirthTime(`${hours}:${mins}`);
              }
            }}
          />
        ))}
    </AuroraSafeArea>
  );
}

/* ─── Private helper components ─── */

type AppTheme = ReturnType<typeof useTheme>["theme"];

function FieldRow({
  label,
  value,
  hasValue,
  onPress,
  dividerColor,
  theme,
  rtl,
  clearable,
  onClear,
}: {
  label: string;
  value: string;
  hasValue: boolean;
  onPress: () => void;
  dividerColor: string;
  theme: AppTheme;
  rtl: boolean;
  clearable?: boolean;
  onClear?: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: dividerColor }}>
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 16,
          minHeight: 64,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.onSurfaceVariant,
              fontSize: 12,
              marginBottom: 2,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: hasValue ? theme.colors.onBackground : theme.colors.onSurfaceVariant,
              textAlign: rtl ? "right" : "left",
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {value}
          </Text>
        </View>
      </Pressable>
      {clearable && onClear ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
          style={{ paddingHorizontal: 16, paddingVertical: 16, minWidth: 48, minHeight: 48, justifyContent: "center" }}
        >
          <Ionicons name="close-circle" size={20} color={theme.colors.onSurfaceVariant} />
        </Pressable>
      ) : null}
    </View>
  );
}

function BottomSheet({
  visible,
  onClose,
  theme,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
        }}
      >
        {children}
      </View>
    </Modal>
  );
}

function SheetDoneButton({ label, onPress, theme }: { label: string; onPress: () => void; theme: AppTheme }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.colors.primary,
        minHeight: 48,
        justifyContent: "center",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: theme.colors.onPrimary,
          fontWeight: "500",
          fontSize: 14,
          letterSpacing: 0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
