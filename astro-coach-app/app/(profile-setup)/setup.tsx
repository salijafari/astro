import { Ionicons } from "@expo/vector-icons";
import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { changeLanguage, type AppLanguage } from "@/lib/i18n";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/onboardingState";
import { writePersistedValue } from "@/lib/storage";
import { invalidateProfileCache } from "@/lib/userProfile";
import { useRouter } from "expo-router";
import { useState, type ChangeEvent, type FC } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

/**
 * First-run profile form: name + birth data saved to PostgreSQL only (PUT /api/user/profile).
 */
const ProfileSetupScreen: FC = () => {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthTime, setBirthTime] = useState<string | null>(null);
  const [birthCity, setBirthCity] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();

  const canSave =
    name.trim().length > 0 &&
    birthDate !== null &&
    birthDate.getTime() < Date.now();

  const formatDate = (d: Date | null) => {
    if (!d) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  };

  const toggleLang = async () => {
    const next: AppLanguage = i18n.language === "en" ? "fa" : "en";
    await changeLanguage(next);
  };

  const handleSave = async () => {
    if (!canSave || !birthDate) return;
    setSaving(true);
    setError(null);
    try {
      const idToken = await getToken();
      if (!idToken) throw new Error("Not authenticated");

      const body: Record<string, unknown> = {
        name: name.trim(),
        birthDate: birthDate.toISOString().split("T")[0],
      };
      if (birthTime) body.birthTime = birthTime;
      if (birthCity?.trim()) body.birthCity = birthCity.trim();

      const res = await apiRequest("/api/user/profile", {
        method: "PUT",
        getToken,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      await invalidateProfileCache();
      await writePersistedValue(ONBOARDING_COMPLETED_KEY, "true");
      router.replace("/(main)/home");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[profile-setup]", msg);
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
      >
        <View className="absolute right-4 top-2 z-10 flex-row gap-2">
          <Pressable
            onPress={() => void toggleLang()}
            className="rounded-lg border border-white/20 px-3 py-2"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-white/80">{i18n.language === "en" ? "FA" : "EN"}</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 40,
            maxWidth: 480,
            width: "100%",
            alignSelf: "center",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 items-center">
            <AkhtarWordmark size="hero" />
          </View>

          <Text className="mb-2 text-center text-2xl font-bold text-white">{t("profileSetup.title")}</Text>
          <Text className="mb-8 text-center text-sm text-white/50">{t("profileSetup.subtitle")}</Text>

          {error ? (
            <View className="mb-4 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3">
              <Text className="text-center text-sm text-red-400">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3">
            <View>
              <Text className="mb-1 ml-1 text-xs text-white/60">
                {t("profileSetup.nameLabel")} *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("profileSetup.namePlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.25)"
                className="rounded-xl border border-white/10 bg-white/8 px-4 py-4 text-base text-white"
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="mb-1 ml-1 text-xs text-white/60">
                {t("profileSetup.dobLabel")} *
              </Text>
              {Platform.OS === "web" ? (
                <View className="rounded-xl border border-white/10 bg-white/8 px-4 py-4">
                  <input
                    type="date"
                    value={birthDate ? birthDate.toISOString().split("T")[0] : ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.value) {
                        setBirthDate(new Date(`${e.target.value}T12:00:00`));
                      }
                    }}
                    max={new Date().toISOString().split("T")[0]}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: birthDate ? "white" : "rgba(255,255,255,0.25)",
                      fontSize: 16,
                      width: "100%",
                      outline: "none",
                      colorScheme: "dark",
                    }}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="flex-row items-center justify-between rounded-xl border border-white/10 bg-white/8 px-4 py-4"
                >
                  <Text className={birthDate ? "text-base text-white" : "text-base text-white/25"}>
                    {birthDate ? formatDate(birthDate) : t("profileSetup.dobPlaceholder")}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.4)" />
                </Pressable>
              )}
            </View>

            <View>
              <View className="mb-1 ml-1 flex-row items-center">
                <Text className="text-xs text-white/60">{t("profileSetup.timeLabel")}</Text>
                <Text className="ml-2 text-xs text-white/30">{t("profileSetup.optional")}</Text>
              </View>
              <View className="flex-row items-center">
                {Platform.OS === "web" ? (
                  <View className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-4">
                    <input
                      type="time"
                      value={birthTime ?? ""}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setBirthTime(e.target.value || null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: birthTime ? "white" : "rgba(255,255,255,0.25)",
                        fontSize: 16,
                        width: "100%",
                        outline: "none",
                        colorScheme: "dark",
                      }}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowTimePicker(true)}
                    className="flex-1 flex-row items-center justify-between rounded-xl border border-white/10 bg-white/8 px-4 py-4"
                  >
                    <Text className={birthTime ? "text-base text-white" : "text-base text-white/25"}>
                      {birthTime ?? t("profileSetup.timePlaceholder")}
                    </Text>
                    <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                )}
                {birthTime ? (
                  <Pressable onPress={() => setBirthTime(null)} className="ml-2 h-10 w-10 items-center justify-center">
                    <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View>
              <View className="mb-1 ml-1 flex-row items-center">
                <Text className="text-xs text-white/60">{t("profileSetup.cityLabel")}</Text>
                <Text className="ml-2 text-xs text-white/30">{t("profileSetup.optional")}</Text>
              </View>
              <View className="flex-row items-center">
                <TextInput
                  value={birthCity ?? ""}
                  onChangeText={(v) => setBirthCity(v || null)}
                  placeholder={t("profileSetup.cityPlaceholder")}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  className="flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-4 text-base text-white"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSave()}
                />
                {birthCity ? (
                  <Pressable onPress={() => setBirthCity(null)} className="ml-2 h-10 w-10 items-center justify-center">
                    <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.4)" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <Text className="mt-4 px-4 text-center text-xs text-white/30">{t("profileSetup.privacyNote")}</Text>

          <Pressable
            onPress={() => void handleSave()}
            disabled={!canSave || saving}
            className={`mt-8 items-center rounded-2xl py-4 ${canSave && !saving ? "bg-indigo-500" : "bg-white/10"}`}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={`text-base font-semibold ${canSave ? "text-white" : "text-white/30"}`}>
                {t("profileSetup.cta")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
};

export default ProfileSetupScreen;
