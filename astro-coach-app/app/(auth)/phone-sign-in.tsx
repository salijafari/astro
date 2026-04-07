import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CosmicBackground } from "@/components/CosmicBackground";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { themes, typography } from "@/constants/theme";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { getFirebaseAuth } from "@/lib/firebase";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const theme = themes.dark;

const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
};

type PhoneConfirmation =
  | import("firebase/auth").ConfirmationResult
  | import("@react-native-firebase/auth").FirebaseAuthTypes.ConfirmationResult;

/**
 * Phone OTP sign-in (Firebase). Web uses invisible reCAPTCHA; native uses React Native Firebase.
 */
export default function PhoneSignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = i18n.language === "fa";
  const { user, loading: authLoading } = useFirebaseAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirmationRef = useRef<PhoneConfirmation | null>(null);
  const recaptchaVerifierRef = useRef<import("firebase/auth").RecaptchaVerifier | null>(null);

  const narrowCtaWidth = Math.min(width - 48, 320);

  const textAlignStyle = {
    textAlign: (rtl ? "right" : "left") as "right" | "left",
    writingDirection: (rtl ? "rtl" : "ltr") as "rtl" | "ltr",
  };

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  /** Web only: ensure DOM target exists for Firebase `RecaptchaVerifier` (id must match). */
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    let el = document.getElementById("recaptcha-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "recaptcha-container";
      el.style.cssText =
        "position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
      document.body.appendChild(el);
    }
    return () => {
      try {
        recaptchaVerifierRef.current?.clear();
      } catch {
        /* noop */
      }
      recaptchaVerifierRef.current = null;
      el?.remove();
    };
  }, []);

  const clearWebVerifier = useCallback(() => {
    if (Platform.OS !== "web") return;
    try {
      recaptchaVerifierRef.current?.clear();
    } catch {
      /* noop */
    }
    recaptchaVerifierRef.current = null;
  }, []);

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const sendOtp = useCallback(async () => {
    if (!phoneNumber.trim()) {
      setError(t("auth.phoneRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (Platform.OS === "web") {
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
        const auth = getFirebaseAuth() as import("firebase/auth").Auth;
        clearWebVerifier();
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
        const confirmationResult = await signInWithPhoneNumber(
          auth,
          phoneNumber.trim(),
          recaptchaVerifierRef.current,
        );
        confirmationRef.current = confirmationResult;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const confirmation = await nativeAuth().signInWithPhoneNumber(phoneNumber.trim());
        confirmationRef.current = confirmation;
      }
      setStep("otp");
    } catch (e: unknown) {
      clearWebVerifier();
      const code = getFirebaseAuthErrorCode(e);
      if (code === "auth/invalid-phone-number") {
        setError(t("auth.phoneInvalid"));
      } else if (code === "auth/too-many-requests") {
        setError(t("auth.phoneRateLimited"));
      } else {
        setError(t("auth.phoneError"));
      }
    } finally {
      setBusy(false);
    }
  }, [phoneNumber, t, clearWebVerifier]);

  const verifyOtp = useCallback(async () => {
    if (!otp.trim() || otp.length < 6) {
      setError(t("auth.otpRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const conf = confirmationRef.current;
      if (!conf) {
        setError(t("auth.otpSessionExpired"));
        return;
      }
      const result = await conf.confirm(otp.trim());
      const signedInUser = result?.user;
      if (!signedInUser) {
        setError(t("auth.otpInvalid"));
        return;
      }
      await syncAuthUserToBackend(signedInUser);
      router.replace("/");
    } catch {
      setError(t("auth.otpInvalid"));
    } finally {
      setBusy(false);
    }
  }, [otp, router, t]);

  const goBackToPhone = useCallback(() => {
    haptic();
    setStep("phone");
    setOtp("");
    setError("");
    confirmationRef.current = null;
    clearWebVerifier();
  }, [haptic, clearWebVerifier]);

  if (authLoading && !user) {
    return (
      <View className="relative flex-1 items-center justify-center overflow-hidden">
        <CosmicBackground colorSchemeOverride="dark" subtleDrift />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="relative flex-1 overflow-hidden" edges={["top", "left", "right"]}>
      <CosmicBackground colorSchemeOverride="dark" subtleDrift />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Math.max(insets.bottom, 20),
            paddingTop: 8,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic();
              router.back();
            }}
            className="mb-2 min-h-[44px] flex-row items-center gap-2 py-2"
            hitSlop={8}
            style={{ flexDirection: rtl ? "row-reverse" : "row" }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.primary} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
            <Text className="text-base font-semibold" style={{ color: theme.colors.primary, fontFamily: typography.family.semibold }}>
              {t("common.back")}
            </Text>
          </Pressable>

          <View style={{ flexGrow: 1, justifyContent: "center", paddingVertical: 12, minHeight: 120 }}>
            <View style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
              <View className="mb-6 items-center">
                <AkhtarWordmark size="home" />
              </View>

              <Text
                className="mb-2 text-2xl font-semibold"
                style={{
                  color: theme.colors.onBackground,
                  fontFamily: typography.family.semibold,
                  ...textAlignStyle,
                }}
              >
                {step === "phone" ? t("auth.phoneTitle") : t("auth.otpTitle")}
              </Text>
              <Text
                className="mb-6 text-sm leading-5"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontFamily: typography.family.regular,
                  ...textAlignStyle,
                }}
              >
                {step === "phone" ? t("auth.phoneSubtitle") : t("auth.otpSubtitle", { phone: phoneNumber.trim() })}
              </Text>

              <View
                className="rounded-3xl border p-4"
                style={{
                  borderColor: theme.colors.outline,
                  backgroundColor: theme.colors.surface,
                }}
              >
                {step === "phone" ? (
                  <>
                    <Text
                      className="mb-2 text-xs font-medium uppercase tracking-wide"
                      style={{ color: theme.colors.onSurfaceVariant, fontFamily: typography.family.medium, ...textAlignStyle }}
                    >
                      {t("auth.phoneLabel")}
                    </Text>
                    <TextInput
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder={t("auth.phonePlaceholder")}
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      editable={!busy}
                      className="rounded-2xl px-4 py-3.5 text-base"
                      style={{
                        color: theme.colors.onBackground,
                        backgroundColor: theme.colors.surfaceVariant,
                        borderWidth: 1,
                        borderColor: theme.colors.outlineVariant,
                        ...textAlignStyle,
                      }}
                    />
                    <Text className="mt-2 text-xs leading-4" style={{ color: theme.colors.onSurfaceVariant, ...textAlignStyle }}>
                      {t("auth.phoneHint")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      className="mb-2 text-xs font-medium uppercase tracking-wide"
                      style={{ color: theme.colors.onSurfaceVariant, fontFamily: typography.family.medium, ...textAlignStyle }}
                    >
                      {t("auth.otpLabel")}
                    </Text>
                    <TextInput
                      value={otp}
                      onChangeText={setOtp}
                      placeholder={t("auth.otpPlaceholder")}
                      placeholderTextColor={theme.colors.onSurfaceVariant}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      editable={!busy}
                      className="rounded-2xl px-4 py-3.5 text-center text-2xl tracking-widest"
                      style={{
                        color: theme.colors.onBackground,
                        backgroundColor: theme.colors.surfaceVariant,
                        borderWidth: 1,
                        borderColor: theme.colors.outlineVariant,
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        if (!busy) goBackToPhone();
                      }}
                      className="mt-3 self-center py-2"
                      hitSlop={8}
                    >
                      <Text className="text-sm leading-5" style={{ color: theme.colors.primary, fontFamily: typography.family.medium }}>
                        {t("auth.resendOtp")}
                      </Text>
                    </Pressable>
                  </>
                )}

                {error ? (
                  <Text className="mt-3 text-sm leading-5" style={{ color: theme.colors.error, ...textAlignStyle }}>
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    haptic();
                    if (busy) return;
                    if (step === "phone") void sendOtp();
                    else void verifyOtp();
                  }}
                  className="mt-6 min-h-[48px] items-center justify-center self-center rounded-2xl px-5 py-3"
                  style={{
                    backgroundColor: theme.colors.primary,
                    opacity: busy ? 0.65 : 1,
                    width: narrowCtaWidth,
                  }}
                >
                  {busy ? (
                    <ActivityIndicator color={theme.colors.onPrimary} />
                  ) : (
                    <Text className="text-base font-semibold" style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}>
                      {step === "phone" ? t("auth.sendOtp") : t("auth.verifyOtp")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
