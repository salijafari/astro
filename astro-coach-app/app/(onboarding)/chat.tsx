import NativeDateTimePicker from "@/components/NativeDateTimePicker";
import { getSunSign, isAtLeast13YearsOld, toJalaliDisplay } from "@/lib/intl";
import { writePersistedValue } from "@/lib/storage";
import { useTheme } from "@/providers/ThemeProvider";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

type OnboardingData = {
  firstName: string;
  birthDate: Date | null;
  birthTime: string | null;
  birthCity: string | null;
  currentStep: 1 | 2 | 3 | 4 | 5;
  isComplete: boolean;
};

type Role = "bot" | "user";
type Message = { id: string; role: Role; text: string };

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

const BotBubble = ({
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
}) => {
  const anim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
        { borderColor, backgroundColor },
      ]}
      className="my-1 self-start rounded-2xl border px-3 py-2"
    >
      <Text
        className="text-xl font-medium"
        style={{ writingDirection: rtl ? "rtl" : "ltr", color: textColor }}
      >
        {text}
      </Text>
    </Animated.View>
  );
};

const UserBubble = ({
  text,
  rtl,
  bgColor,
  textColor,
}: {
  text: string;
  rtl: boolean;
  bgColor: string;
  textColor: string;
}) => (
  <View
    className="my-1 self-end rounded-2xl px-3 py-2"
    style={{ backgroundColor: bgColor }}
  >
    <Text
      className="text-xl font-semibold"
      style={{ color: textColor, writingDirection: rtl ? "rtl" : "ltr" }}
    >
      {text}
    </Text>
  </View>
);

export default function OnboardingChatScreen() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "fa";
  const { theme } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [data, setData] = useState<OnboardingData>({
    firstName: "",
    birthDate: null,
    birthTime: null,
    birthCity: null,
    currentStep: 1,
    isComplete: false,
  });

  const [messages, setMessages] = useState<Message[]>([
    { id: "b0", role: "bot", text: t("onboarding.askFirstName") },
  ]);
  const [textInput, setTextInput] = useState("");
  const [pickedDate, setPickedDate] = useState(new Date(1995, 0, 1));
  const [pickedTime, setPickedTime] = useState(new Date());
  const [cityInput, setCityInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

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

  const pushBot = (text: string) =>
    setMessages((prev) => [
      ...prev,
      { id: `b${prev.length}`, role: "bot", text },
    ]);
  const pushUser = (text: string) =>
    setMessages((prev) => [
      ...prev,
      { id: `u${prev.length}`, role: "user", text },
    ]);

  // ── Step 1: First name ───────────────────────────────────────────
  const submitName = () => {
    const name = textInput.trim();
    if (name.length < 1 || /\d/.test(name)) {
      pushBot(t("onboarding.invalidName"));
      return;
    }
    pushUser(name);
    setData((prev) => ({ ...prev, firstName: name, currentStep: 2 }));
    pushBot(t("onboarding.greetUser", { name }));
    setTextInput("");
    setTimeout(() => pushBot(t("onboarding.askBirthday")), 400);
  };

  // ── Step 2: Birthday ─────────────────────────────────────────────
  const submitBirthday = () => {
    if (pickedDate > new Date() || !isAtLeast13YearsOld(pickedDate)) {
      pushBot(t("onboarding.invalidBirthday"));
      return;
    }
    const display =
      i18n.language === "fa"
        ? toJalaliDisplay(pickedDate)
        : pickedDate.toLocaleDateString("en-US");
    pushUser(display);
    setData((prev) => ({ ...prev, birthDate: pickedDate, currentStep: 3 }));
    const sign = getSunSign(pickedDate);
    pushBot(t("onboarding.sunSignAck", { sign }));
    setTimeout(() => pushBot(t("onboarding.askBirthTime")), 400);
  };

  // ── Step 3: Birth time ───────────────────────────────────────────
  const submitTimeYes = () => {
    pushUser(t("onboarding.yes"));
    setData((prev) => ({ ...prev, currentStep: 3.5 as 3 }));
  };

  const submitTimeValue = () => {
    const hh = String(pickedTime.getHours()).padStart(2, "0");
    const mm = String(pickedTime.getMinutes()).padStart(2, "0");
    const time = `${hh}:${mm}`;
    pushUser(time);
    setData((prev) => ({ ...prev, birthTime: time, currentStep: 4 }));
    setTimeout(() => pushBot(t("onboarding.askBirthCity")), 400);
  };

  const submitTimeNotSure = () => {
    pushUser(t("onboarding.notSure"));
    setData((prev) => ({ ...prev, birthTime: null, currentStep: 4 }));
    pushBot(t("onboarding.noTimeOk"));
    setTimeout(() => pushBot(t("onboarding.askBirthCity")), 400);
  };

  // ── Step 4: Birth city ───────────────────────────────────────────
  const submitCityKnow = () => {
    pushUser(t("onboarding.iKnow"));
    setData((prev) => ({ ...prev, currentStep: 4.5 as 4 }));
  };

  const submitCityValue = () => {
    const city = cityInput.trim();
    if (!city) return;
    pushUser(city);
    setCityInput("");
    setData((prev) => ({ ...prev, birthCity: city, currentStep: 5 }));
    finishChat(city);
  };

  const submitCitySkip = () => {
    pushUser(t("onboarding.skip"));
    setData((prev) => ({ ...prev, birthCity: null, currentStep: 5 }));
    finishChat(null);
  };

  // ── Step 5: Transition ───────────────────────────────────────────
  const finishChat = async (city: string | null) => {
    pushBot(t("onboarding.allDone"));
    setSaving(true);

    const finalData = {
      ...data,
      birthCity: city,
      currentStep: 5 as const,
      isComplete: true,
    };

    const storagePayload = {
      firstName: finalData.firstName,
      birthDate: finalData.birthDate?.toISOString().slice(0, 10) ?? null,
      birthTime: finalData.birthTime,
      birthCity: finalData.birthCity,
    };

    await writePersistedValue(
      "akhtar.pendingOnboarding",
      JSON.stringify(storagePayload),
    );

    setTimeout(() => {
      setSaving(false);
      router.replace("/(onboarding)/welcome");
    }, 1500);
  };

  // ── Determine which step input to show ───────────────────────────
  const showTimeYesNo = data.currentStep === 3;
  const showTimePicker =
    (data.currentStep as number) === 3.5 && data.birthTime === null;
  const showCityYesNo = data.currentStep === 4;
  const showCityInput = (data.currentStep as number) === 4.5;

  return (
    <View
      className="flex-1 px-4 pt-12"
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text
        className="mb-3 text-center text-3xl font-semibold"
        style={{ color: theme.colors.onBackground }}
      >
        {t("onboarding.getSetUpTitle")}
      </Text>
      <View
        className="h-px w-full"
        style={{ backgroundColor: theme.colors.outlineVariant }}
      />

      <ScrollView ref={scrollRef} className="flex-1 py-4">
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
            <UserBubble
              key={m.id}
              text={m.text}
              rtl={rtl}
              bgColor={theme.colors.primaryContainer}
              textColor={theme.colors.onPrimaryContainer}
            />
          ),
        )}
        {saving ? (
          <View className="my-4 items-center">
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : null}
      </ScrollView>

      {/* ── Step 1: Name input ─────────────────────────────────── */}
      {data.currentStep === 1 ? (
        <View className="pb-4">
          <View
            className="rounded-full px-4 py-3"
            style={{ backgroundColor: theme.colors.surfaceVariant }}
          >
            <TextInput
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={submitName}
              returnKeyType="done"
              blurOnSubmit
              placeholder={t("onboarding.askFirstName")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              style={{
                color: theme.colors.onBackground,
                textAlign: rtl ? "right" : "left",
                fontSize: 20,
                paddingVertical: 8,
              }}
            />
          </View>
          <Pressable
            onPress={submitName}
            className="mt-3 min-h-[52px] justify-center rounded-full px-4 py-4"
            style={{ backgroundColor: theme.colors.onBackground }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.background }}
            >
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Step 2: Birthday picker ────────────────────────────── */}
      {data.currentStep === 2 ? (
        <View className="pb-4">
          {Platform.OS === "web" ? (
            <View
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            >
              <input
                type="date"
                value={pickedDate.toISOString().slice(0, 10)}
                onChange={(e) =>
                  setPickedDate(new Date(e.currentTarget.value))
                }
                style={webInputStyle}
              />
            </View>
          ) : (
            <NativeDateTimePicker
              value={pickedDate}
              mode="date"
              display="spinner"
              onChange={(_, d) => d && setPickedDate(d)}
            />
          )}
          <Pressable
            onPress={submitBirthday}
            className="mt-3 min-h-[52px] justify-center rounded-full px-4 py-4"
            style={{ backgroundColor: theme.colors.onBackground }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.background }}
            >
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Step 3: Birth time yes/no ──────────────────────────── */}
      {showTimeYesNo ? (
        <View className="gap-2 pb-4">
          <Pressable
            onPress={submitTimeYes}
            className="min-h-[52px] justify-center rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.onBackground }}
            >
              {t("onboarding.yes")}
            </Text>
          </Pressable>
          <Pressable
            onPress={submitTimeNotSure}
            className="min-h-[52px] justify-center rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.onBackground }}
            >
              {t("onboarding.notSure")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Step 3.5: Time picker ──────────────────────────────── */}
      {showTimePicker ? (
        <View className="pb-4">
          {Platform.OS === "web" ? (
            <View
              className="rounded-2xl px-4 py-3"
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            >
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
            <NativeDateTimePicker
              value={pickedTime}
              mode="time"
              display="spinner"
              onChange={(_, d) => d && setPickedTime(d)}
            />
          )}
          <Pressable
            onPress={submitTimeValue}
            className="mt-3 min-h-[52px] justify-center rounded-full px-4 py-4"
            style={{ backgroundColor: theme.colors.onBackground }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.background }}
            >
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Step 4: City yes/no ────────────────────────────────── */}
      {showCityYesNo ? (
        <View className="gap-2 pb-4">
          <Pressable
            onPress={submitCityKnow}
            className="min-h-[52px] justify-center rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.onBackground }}
            >
              {t("onboarding.iKnow")}
            </Text>
          </Pressable>
          <Pressable
            onPress={submitCitySkip}
            className="min-h-[52px] justify-center rounded-full border px-4 py-4"
            style={{ borderColor: theme.colors.outline }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.onBackground }}
            >
              {t("onboarding.skip")}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Step 4.5: City text input ──────────────────────────── */}
      {showCityInput ? (
        <View className="pb-4">
          <View
            className="rounded-full px-4 py-3"
            style={{ backgroundColor: theme.colors.surfaceVariant }}
          >
            <TextInput
              value={cityInput}
              onChangeText={setCityInput}
              onSubmitEditing={submitCityValue}
              returnKeyType="done"
              blurOnSubmit
              placeholder={t("onboarding.askBirthCity")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              selectionColor={theme.colors.primary}
              cursorColor={theme.colors.primary}
              style={{
                color: theme.colors.onBackground,
                textAlign: rtl ? "right" : "left",
                fontSize: 20,
                paddingVertical: 8,
              }}
            />
          </View>
          <Pressable
            onPress={submitCityValue}
            className="mt-3 min-h-[52px] justify-center rounded-full px-4 py-4"
            style={{ backgroundColor: theme.colors.onBackground }}
          >
            <Text
              className="text-center text-xl font-semibold"
              style={{ color: theme.colors.background }}
            >
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
