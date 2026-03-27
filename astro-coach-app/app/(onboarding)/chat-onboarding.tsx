import { Ionicons } from "@expo/vector-icons";
import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { apiPostJson } from "@/lib/api";
import { getSunSign, isAtLeast13YearsOld, toJalaliDisplay } from "@/lib/intl";
import { setOnboardingCompletedLocally } from "@/lib/onboardingState";
import { useOnboardingFlowStore } from "@/stores/onboardingFlowStore";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";

type Role = "bot" | "user";
type Message = { id: string; role: Role; text: string };
type Step = "name" | "birthday" | "timeKnown" | "timeValue" | "cityKnown" | "cityValue" | "done";

type WebInputStyle = {
  width: string;
  background: string;
  color: string;
  border: string;
  outline: string;
  fontSize: number;
  colorScheme: "dark";
  WebkitTextFillColor: string;
};

function BotBubble({
  text,
  rtl,
  textColor,
  borderColor,
  backgroundColor,
}: {
  text: string;
  rtl: boolean;
  textColor: string;
  borderColor: string;
  backgroundColor: string;
}) {
  const anim = useMemo(() => new Animated.Value(0), []);
  Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  return (
    <Animated.View
      style={[
        { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
        { borderColor, backgroundColor },
      ]}
      className="my-1 self-start rounded-2xl border px-3 py-2"
    >
      <Text className="text-xl font-medium" style={{ writingDirection: rtl ? "rtl" : "ltr", color: textColor }}>
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
  const [cityInput, setCityInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const flow = useOnboardingFlowStore();
  const webInputStyle: WebInputStyle = {
    width: "100%",
    background: "transparent",
    color: theme.colors.onBackground,
    border: "none",
    outline: "none",
    fontSize: 18,
    colorScheme: "dark",
    WebkitTextFillColor: theme.colors.onBackground,
  };

  const pushBot = (text: string) => setMessages((prev) => [...prev, { id: `b${prev.length}`, role: "bot", text }]);
  const pushUser = (text: string) => setMessages((prev) => [...prev, { id: `u${prev.length}`, role: "user", text }]);

  const askNext = (next: Step) => {
    setStep(next);
    if (next === "birthday") pushBot(t("onboarding.askBirthday"));
    if (next === "timeKnown") pushBot(t("onboarding.askBirthTime"));
    if (next === "cityKnown") pushBot(t("onboarding.askBirthCity"));
  };

  const goBack = () => {
    if (submitting) return;
    
    if (step === "name") {
      router.back();
    } else if (step === "birthday") {
      setMessages((prev) => prev.slice(0, -3));
      setStep("name");
    } else if (step === "timeKnown") {
      setMessages((prev) => prev.slice(0, -3));
      setStep("birthday");
    } else if (step === "timeValue") {
      setMessages((prev) => prev.slice(0, -1));
      setStep("timeKnown");
    } else if (step === "cityKnown") {
      setMessages((prev) => prev.slice(0, -2));
      setStep("timeValue");
    } else if (step === "cityValue") {
      setMessages((prev) => prev.slice(0, -1));
      setStep("cityKnown");
    }
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

  /** Birth city: free text only — no Places/geocode. Server applies default chart coords when lat/lng/tz are null. */
  type BirthPlacePayload = {
    birthCity: string | null;
    birthLatitude: number | null;
    birthLongitude: number | null;
    birthTimezone: string | null;
  };

  /** Persist birth place + mark onboarding complete on server (user never sees this flow again). */
  const persistBirthPlaceAndFinish = async (d: BirthPlacePayload) => {
    flow.setPartial({
      birthCity: d.birthCity,
      birthLatitude: d.birthLatitude,
      birthLongitude: d.birthLongitude,
      birthTimezone: d.birthTimezone,
    });
    const st = useOnboardingFlowStore.getState();
    if (!st.birthDate) {
      pushBot(t("onboarding.invalidBirthday"));
      setStep("birthday");
      return;
    }
    try {
      await apiPostJson("/api/onboarding/complete", getToken, {
        firstName: st.firstName,
        birthDate: st.birthDate,
        birthTime: st.birthTime,
        birthCity: d.birthCity,
        birthLatitude: d.birthLatitude,
        birthLongitude: d.birthLongitude,
        birthTimezone: d.birthTimezone,
        languagePreference: st.languagePreference,
      });
    } catch (e) {
      console.warn("[chat-onboarding] API call failed, completing locally anyway", e);
    }
    await setOnboardingCompletedLocally(true);
    router.replace("/(main)/home");
  };

  /** User typed a city (any text). Empty + Continue = skip (null city). */
  const finishCityStep = async () => {
    if (submitting) return;
    const q = cityInput.trim();
    if (!q) {
      setSubmitting(true);
      try {
        await completeOnboardingWithDefaults();
      } finally {
        setSubmitting(false);
      }
      return;
    }
    pushUser(q);
    setStep("done");
    setSubmitting(true);
    try {
      await persistBirthPlaceAndFinish({
        birthCity: q,
        birthLatitude: null,
        birthLongitude: null,
        birthTimezone: null,
      });
    } catch (e) {
      console.warn("[chat-onboarding] onboarding/complete failed, completing locally", e);
      await setOnboardingCompletedLocally(true);
      router.replace("/(main)/home");
    } finally {
      setSubmitting(false);
    }
  };

  /** Complete onboarding when user skips birth city / time — no city string; server uses defaults for chart. */
  const completeOnboardingWithDefaults = async () => {
    const st = useOnboardingFlowStore.getState();
    if (!st.birthDate) {
      pushBot(t("onboarding.invalidBirthday"));
      setStep("birthday");
      return;
    }
    try {
      await apiPostJson("/api/onboarding/complete", getToken, {
        firstName: st.firstName,
        birthDate: st.birthDate,
        birthTime: st.birthTime,
        birthCity: null,
        birthLatitude: null,
        birthLongitude: null,
        birthTimezone: null,
        languagePreference: st.languagePreference,
      });
    } catch (e) {
      console.warn("[chat-onboarding] API call failed, completing locally anyway", e);
    }
    await setOnboardingCompletedLocally(true);
    router.replace("/(main)/home");
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
            <BotBubble
              key={m.id}
              text={m.text}
              rtl={rtl}
              textColor={theme.colors.onBackground}
              borderColor={theme.colors.outline}
              backgroundColor={theme.colors.surface}
            />
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
              onSubmitEditing={submitName}
              placeholder={t("onboarding.askName")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left", fontSize: 20, paddingVertical: 8 }}
            />
          </View>
          <View className="flex-row gap-3 mt-3">
            <Pressable onPress={goBack} disabled={submitting} className="rounded-full border px-4 py-4 justify-center items-center" style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.5 : 1 }}>
              <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
            </Pressable>
            <Pressable onPress={submitName} disabled={submitting} className="flex-1 rounded-full px-4 py-4 justify-center" style={{ backgroundColor: theme.colors.onBackground, opacity: submitting ? 0.5 : 1 }}>
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
                {t("common.continue")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === "birthday" ? (
        <View className="pb-4">
          {Platform.OS === "web" ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
              {/* web-only native input */}
              <input
                type="date"
                value={pickedDate.toISOString().slice(0, 10)}
                onChange={(e) => setPickedDate(new Date(e.currentTarget.value))}
                style={webInputStyle}
              />
            </View>
          ) : (
            <NativeDateTimePicker value={pickedDate} mode="date" display="spinner" onChange={(_, d) => d && setPickedDate(d)} />
          )}
          <View className="flex-row gap-3 mt-3">
            <Pressable onPress={goBack} disabled={submitting} className="rounded-full border px-4 py-4 justify-center items-center" style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.5 : 1 }}>
              <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
            </Pressable>
            <Pressable onPress={() => submitBirthday(pickedDate)} disabled={submitting} className="flex-1 rounded-full px-4 py-4 justify-center" style={{ backgroundColor: theme.colors.onBackground, opacity: submitting ? 0.5 : 1 }}>
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
                {t("onboarding.confirmDate")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === "timeKnown" ? (
        <View className="gap-2 pb-4">
          <View className="flex-row gap-3">
            <Pressable onPress={goBack} disabled={submitting} className="rounded-full border px-4 py-4 justify-center items-center" style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.5 : 1 }}>
              <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
            </Pressable>
            <Pressable
              onPress={() => {
                pushUser(t("onboarding.yesKnowTime"));
                setStep("timeValue");
              }}
              className="flex-1 rounded-full border px-4 py-4 justify-center"
              style={{ borderColor: theme.colors.outline }}
            >
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
                {t("onboarding.yesKnowTime")}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              if (submitting) return;
              flow.setPartial({ birthTime: null });
              pushUser(t("onboarding.notSureTime"));
              setSubmitting(true);
              void (async () => {
                try {
                  await completeOnboardingWithDefaults();
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
            className="rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.6 : 1 }}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.onBackground} />
            ) : (
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
                {t("onboarding.notSureTime")}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {step === "timeValue" ? (
        <View className="pb-4">
          {Platform.OS === "web" ? (
            <View className="rounded-2xl px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
              {/* web-only native input */}
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
                style={webInputStyle}
              />
            </View>
          ) : (
            <NativeDateTimePicker value={pickedTime} mode="time" display="spinner" onChange={(_, d) => d && setPickedTime(d)} />
          )}
          <View className="flex-row gap-3 mt-3">
            <Pressable onPress={goBack} disabled={submitting} className="rounded-full border px-4 py-4 justify-center items-center" style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.5 : 1 }}>
              <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
            </Pressable>
            <Pressable onPress={submitTimeValue} disabled={submitting} className="flex-1 rounded-full px-4 py-4 justify-center" style={{ backgroundColor: theme.colors.onBackground, opacity: submitting ? 0.5 : 1 }}>
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
                {t("onboarding.confirmTime")}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === "cityKnown" ? (
        <View className="gap-2 pb-4">
          <View className="flex-row gap-3">
            <Pressable onPress={goBack} disabled={submitting} className="rounded-full border px-4 py-4 justify-center items-center" style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.5 : 1 }}>
              <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
            </Pressable>
            <Pressable onPress={() => {
              pushUser(t("onboarding.cityKnowYes"));
              setStep("cityValue");
            }} className="flex-1 rounded-full border px-4 py-4 justify-center" style={{ borderColor: theme.colors.outline }}>
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
                {t("onboarding.cityKnowYes")}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              if (submitting) return;
              setSubmitting(true);
              void (async () => {
                try {
                  await completeOnboardingWithDefaults();
                } finally {
                  setSubmitting(false);
                }
              })();
            }}
            className="rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.6 : 1 }}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={theme.colors.onBackground} />
            ) : (
              <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.onBackground }}>
                {t("onboarding.cityKnowNo")}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {step === "cityValue" ? (
        <View className="pb-4">
          <View className="rounded-full px-4 py-3" style={{ backgroundColor: theme.colors.surfaceVariant }}>
            <TextInput
              value={cityInput}
              onChangeText={setCityInput}
              onSubmitEditing={() => void finishCityStep()}
              placeholder={t("onboarding.cityPlaceholder")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left", fontSize: 20, paddingVertical: 8 }}
            />
          </View>
          <View className="flex-row gap-3 mt-3">
            <Pressable onPress={goBack} disabled={submitting} className="rounded-full border px-4 py-4 justify-center items-center" style={{ borderColor: theme.colors.outline, opacity: submitting ? 0.5 : 1 }}>
              <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={theme.colors.onBackground} />
            </Pressable>
            <Pressable
              onPress={() => void finishCityStep()}
              disabled={submitting}
              className="flex-1 mt-0 rounded-full px-4 py-4 justify-center"
              style={{
                backgroundColor: theme.colors.onBackground,
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.background} />
              ) : (
                <Text className="text-center text-xl font-semibold" style={{ color: theme.colors.background }}>
                  {t("onboarding.enterDashboard")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
