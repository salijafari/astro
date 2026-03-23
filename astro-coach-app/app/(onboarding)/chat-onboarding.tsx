import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { apiPostJson } from "@/lib/api";
import { getSunSign, isAtLeast13YearsOld, toJalaliDisplay } from "@/lib/intl";
import { useOnboardingFlowStore } from "@/stores/onboardingFlowStore";
import { useAuth } from "@clerk/clerk-expo";
import { useTheme } from "@/providers/ThemeProvider";

type Role = "bot" | "user";
type Message = { id: string; role: Role; text: string };
type Step = "name" | "birthday" | "timeKnown" | "timeValue" | "cityKnown" | "cityValue" | "done";

type CitySuggestion = { id: string; name: string; country?: string; lat?: number; lng?: number; timezone?: string };

function BotBubble({ text, rtl }: { text: string; rtl: boolean }) {
  const anim = useMemo(() => new Animated.Value(0), []);
  Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}
      className="my-1 self-start rounded-2xl border px-3 py-2"
    >
      <Text className="text-xl font-medium" style={{ writingDirection: rtl ? "rtl" : "ltr" }}>
        {text}
      </Text>
    </Animated.View>
  );
}

export default function ChatOnboardingScreen() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "fa";
  const { theme } = useTheme();
  const router = useRouter();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{ id: "m1", role: "bot", text: t("onboarding.askName") }]);
  const [step, setStep] = useState<Step>("name");
  const [textInput, setTextInput] = useState("");
  const [pickedDate, setPickedDate] = useState<Date>(new Date(1995, 0, 1));
  const [pickedTime, setPickedTime] = useState<Date>(new Date());
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityInput, setCityInput] = useState("");
  const flow = useOnboardingFlowStore();

  const pushBot = (text: string) => setMessages((prev) => [...prev, { id: `b${prev.length}`, role: "bot", text }]);
  const pushUser = (text: string) => setMessages((prev) => [...prev, { id: `u${prev.length}`, role: "user", text }]);

  const askNext = (next: Step) => {
    setStep(next);
    if (next === "birthday") pushBot(t("onboarding.askBirthday"));
    if (next === "timeKnown") pushBot(t("onboarding.askBirthTime"));
    if (next === "cityKnown") pushBot(t("onboarding.askBirthCity"));
  };

  const submitName = () => {
    const name = textInput.trim();
    if (!/^[^\d]+$/u.test(name) || name.length < 1) {
      pushBot(t("onboarding.invalidName"));
      return;
    }
    flow.setPartial({ firstName: name, languagePreference: i18n.language === "fa" ? "fa" : "en" });
    pushUser(name);
    pushBot(t("onboarding.nameReply", { name }));
    setTextInput("");
    askNext("birthday");
  };

  const submitBirthday = (date: Date) => {
    if (date > new Date() || !isAtLeast13YearsOld(date)) {
      pushBot(t("onboarding.invalidBirthday"));
      return;
    }
    const iso = date.toISOString();
    flow.setPartial({ birthDate: iso });
    const display = i18n.language === "fa" ? toJalaliDisplay(date) : date.toLocaleDateString("en-US");
    pushUser(display);
    pushBot(t("onboarding.sunFact", { sign: getSunSign(date) }));
    askNext("timeKnown");
  };

  const submitTimeValue = () => {
    const hh = String(pickedTime.getHours()).padStart(2, "0");
    const mm = String(pickedTime.getMinutes()).padStart(2, "0");
    const time = `${hh}:${mm}`;
    flow.setPartial({ birthTime: time });
    pushUser(time);
    askNext("cityKnown");
  };

  const lookupCities = async (q: string) => {
    setCityInput(q);
    if (q.length < 2) {
      setCitySuggestions([]);
      return;
    }
    const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&key=${key}`,
      );
      const json = (await res.json()) as { predictions?: Array<{ place_id: string; description: string }> };
      const mapped = (json.predictions ?? []).slice(0, 5).map((p) => ({ id: p.place_id, name: p.description }));
      setCitySuggestions(mapped);
    } catch {
      setCitySuggestions([]);
    }
  };

  const chooseCity = async (c: CitySuggestion) => {
    flow.setPartial({
      birthCity: c.name,
      birthLatitude: c.lat ?? null,
      birthLongitude: c.lng ?? null,
      birthTimezone: c.timezone ?? "UTC",
    });
    pushUser(c.name);
    setStep("done");
    await apiPostJson(
      "/api/onboarding/complete",
      getToken,
      useOnboardingFlowStore.getState(),
    ).catch(() => null);
    router.replace("/(onboarding)/welcome-paywall");
  };

  const submitDoneWithoutCity = async () => {
    flow.setPartial({
      birthCity: null,
      birthLatitude: null,
      birthLongitude: null,
      birthTimezone: null,
    });
    setStep("done");
    await apiPostJson("/api/onboarding/complete", getToken, useOnboardingFlowStore.getState()).catch(() => null);
    router.replace("/(onboarding)/welcome-paywall");
  };

  return (
    <View className="flex-1 px-4 pt-12" style={{ backgroundColor: theme.colors.background }}>
      <Text className="mb-3 text-center text-3xl font-semibold" style={{ color: theme.colors.onBackground }}>
        {t("onboarding.chatTitle")}
      </Text>
      <View className="h-px w-full" style={{ backgroundColor: theme.colors.outlineVariant }} />
      <ScrollView className="flex-1 py-4">
        {messages.map((m) =>
          m.role === "bot" ? (
            <BotBubble key={m.id} text={m.text} rtl={rtl} />
          ) : (
            <View key={m.id} className="my-1 self-end rounded-2xl px-3 py-2" style={{ backgroundColor: theme.colors.primaryContainer }}>
              <Text className="text-xl font-semibold" style={{ color: theme.colors.onPrimaryContainer, writingDirection: rtl ? "rtl" : "ltr" }}>
                {m.text}
              </Text>
            </View>
          ),
        )}
      </ScrollView>

      {step === "name" ? (
        <View className="pb-4">
          <View className="rounded-full px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
            <TextInput
              value={textInput}
              onChangeText={setTextInput}
              placeholder={t("onboarding.askName")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left" }}
            />
          </View>
          <Pressable onPress={submitName} className="mt-3 rounded-full px-4 py-4" style={{ backgroundColor: theme.colors.onBackground }}>
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === "birthday" ? (
        <View className="pb-4">
          {Platform.OS === "web" ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
              {/* web-only native input */}
              {/* eslint-disable-next-line react/no-unknown-property */}
              <input
                type="date"
                value={pickedDate.toISOString().slice(0, 10)}
                onChange={(e) => setPickedDate(new Date(e.currentTarget.value))}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: theme.colors.onBackground,
                  border: "none",
                  outline: "none",
                  fontSize: 18,
                }}
              />
            </View>
          ) : (
            <DateTimePicker value={pickedDate} mode="date" display="spinner" onChange={(_, d) => d && setPickedDate(d)} />
          )}
          <Pressable onPress={() => submitBirthday(pickedDate)} className="mt-3 rounded-full px-4 py-4" style={{ backgroundColor: theme.colors.onBackground }}>
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
              {t("onboarding.confirmDate")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === "timeKnown" ? (
        <View className="gap-2 pb-4">
          <Pressable
            onPress={() => {
              pushUser(t("onboarding.yesKnowTime"));
              setStep("timeValue");
            }}
            className="rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("onboarding.yesKnowTime")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              flow.setPartial({ birthTime: null });
              pushUser(t("onboarding.notSureTime"));
              pushBot(t("onboarding.timeUnknown"));
              askNext("cityKnown");
            }}
            className="rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("onboarding.notSureTime")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === "timeValue" ? (
        <View className="pb-4">
          {Platform.OS === "web" ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
              {/* web-only native input */}
              {/* eslint-disable-next-line react/no-unknown-property */}
              <input
                type="time"
                value={`${String(pickedTime.getHours()).padStart(2, "0")}:${String(pickedTime.getMinutes()).padStart(2, "0")}`}
                onChange={(e) => {
                  const [h, m] = e.currentTarget.value.split(":");
                  const next = new Date();
                  next.setHours(Number(h || 0));
                  next.setMinutes(Number(m || 0));
                  setPickedTime(next);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  color: theme.colors.onBackground,
                  border: "none",
                  outline: "none",
                  fontSize: 18,
                }}
              />
            </View>
          ) : (
            <DateTimePicker value={pickedTime} mode="time" display="spinner" onChange={(_, d) => d && setPickedTime(d)} />
          )}
          <Pressable onPress={submitTimeValue} className="mt-3 rounded-full px-4 py-4" style={{ backgroundColor: theme.colors.onBackground }}>
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
              {t("onboarding.confirmTime")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === "cityKnown" ? (
        <View className="gap-2 pb-4">
          <Pressable onPress={() => setStep("cityValue")} className="rounded-full border px-4 py-4" style={{ borderColor: theme.colors.outline }}>
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("onboarding.cityYes")}
            </Text>
          </Pressable>
          <Pressable onPress={() => void submitDoneWithoutCity()} className="rounded-full border px-4 py-4" style={{ borderColor: theme.colors.outline }}>
            <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
              {t("onboarding.cityNo")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === "cityValue" ? (
        <View className="pb-4">
          <View className="rounded-full px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
            <TextInput
              value={cityInput}
              onChangeText={(v) => void lookupCities(v)}
              placeholder={t("onboarding.cityPlaceholder")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left" }}
            />
          </View>
          <View className="mt-3 gap-2">
            {citySuggestions.map((city) => (
              <Pressable key={city.id} onPress={() => void chooseCity(city)} className="rounded-xl border px-4 py-3" style={{ borderColor: theme.colors.outline }}>
                <Text style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}>{city.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
