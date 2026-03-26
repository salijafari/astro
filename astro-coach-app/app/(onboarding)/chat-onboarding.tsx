import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { apiGetJson, apiPostJson } from "@/lib/api";
import { getSunSign, isAtLeast13YearsOld, toJalaliDisplay } from "@/lib/intl";
import { setOnboardingCompletedLocally } from "@/lib/onboardingState";
import { useOnboardingFlowStore } from "@/stores/onboardingFlowStore";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/providers/ThemeProvider";

type Role = "bot" | "user";
type Message = { id: string; role: Role; text: string };
type Step = "name" | "birthday" | "timeKnown" | "timeValue" | "cityKnown" | "cityValue" | "done";

type CitySuggestion = { id: string; name: string; country?: string; lat?: number; lng?: number; timezone?: string };
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
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityInput, setCityInput] = useState("");
  /** Set when user picks a row from Google suggestions (has place_id). */
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
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
    setSelectedCity(null);
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

  type PlaceDetails = {
    birthCity: string;
    birthLat: number;
    birthLong: number;
    birthTimezone: string;
  };

  /** Persist birth place + mark onboarding complete on server (user never sees this flow again). */
  const persistBirthPlaceAndFinish = async (d: PlaceDetails) => {
    flow.setPartial({
      birthCity: d.birthCity,
      birthLatitude: d.birthLat,
      birthLongitude: d.birthLong,
      birthTimezone: d.birthTimezone,
    });
    const st = useOnboardingFlowStore.getState();
    if (!st.birthDate) {
      pushBot(t("onboarding.invalidBirthday"));
      setStep("birthday");
      return;
    }
    await apiPostJson("/api/onboarding/complete", getToken, {
      firstName: st.firstName,
      birthDate: st.birthDate,
      birthTime: st.birthTime,
      birthCity: d.birthCity,
      birthLatitude: d.birthLat,
      birthLongitude: d.birthLong,
      birthTimezone: d.birthTimezone,
      languagePreference: st.languagePreference,
    });
    await setOnboardingCompletedLocally(true);
    router.replace("/(main)/home");
  };

  const chooseCity = async (c: CitySuggestion) => {
    pushUser(c.name);
    setStep("done");
    setSubmitting(true);
    try {
      const d = await apiGetJson<PlaceDetails>(`/api/places/details?place_id=${encodeURIComponent(c.id)}`, getToken);
      await persistBirthPlaceAndFinish(d);
    } catch (e) {
      console.warn("[chat-onboarding] could not save birth place", e);
      pushBot(t("onboarding.askBirthCity"));
      setStep("cityKnown");
    } finally {
      setSubmitting(false);
    }
  };

  /** Free-text city name via server Geocoding API (when user didn't tap a suggestion). */
  const geocodeCityAndFinish = async () => {
    const q = cityInput.trim();
    if (q.length < 2) {
      pushBot(t("onboarding.cityTooShort"));
      return;
    }
    pushUser(q);
    setStep("done");
    setSubmitting(true);
    try {
      const d = await apiGetJson<PlaceDetails>(`/api/places/geocode?address=${encodeURIComponent(q)}`, getToken);
      await persistBirthPlaceAndFinish(d);
    } catch (e) {
      console.warn("[chat-onboarding] geocode failed", e);
      pushBot(t("onboarding.cityGeocodeError"));
      setStep("cityValue");
    } finally {
      setSubmitting(false);
    }
  };

  const onPressGoToDashboard = async () => {
    if (submitting) return;
    if (selectedCity) {
      await chooseCity(selectedCity);
      return;
    }
    await geocodeCityAndFinish();
  };

  /** Complete onboarding with default location (Greenwich) when user skips birth city / time. */
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
        birthCity: "Greenwich, UK",
        birthLatitude: 51.4769,
        birthLongitude: 0.0,
        birthTimezone: "Europe/London",
        languagePreference: st.languagePreference,
      });
      await setOnboardingCompletedLocally(true);
      router.replace("/(main)/home");
    } catch (e) {
      console.warn("[chat-onboarding] could not complete without city", e);
      pushBot(t("onboarding.askBirthCity"));
      setStep("cityKnown");
    }
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
              placeholder={t("onboarding.askName")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
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
                style={webInputStyle}
              />
            </View>
          ) : (
            <NativeDateTimePicker value={pickedDate} mode="date" display="spinner" onChange={(_, d) => d && setPickedDate(d)} />
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
                style={webInputStyle}
              />
            </View>
          ) : (
            <NativeDateTimePicker value={pickedTime} mode="time" display="spinner" onChange={(_, d) => d && setPickedTime(d)} />
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
              {t("onboarding.cityKnowYes")}
            </Text>
          </Pressable>
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
              onChangeText={(v) => void lookupCities(v)}
              placeholder={t("onboarding.cityPlaceholder")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              style={{ color: theme.colors.onBackground, textAlign: rtl ? "right" : "left" }}
            />
          </View>
          {citySuggestions.length > 0 ? (
            <View className="mt-3 gap-2">
              {citySuggestions.map((city) => (
                <Pressable
                  key={city.id}
                  onPress={() => {
                    setSelectedCity(city);
                    setCityInput(city.name);
                    setCitySuggestions([]);
                  }}
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: theme.colors.outline }}
                >
                  <Text style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}>{city.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => void onPressGoToDashboard()}
            disabled={submitting || cityInput.trim().length < 2}
            className="mt-3 rounded-full px-4 py-4"
            style={{
              backgroundColor: theme.colors.onBackground,
              opacity: submitting || cityInput.trim().length < 2 ? 0.5 : 1,
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
      ) : null}
    </View>
  );
}
