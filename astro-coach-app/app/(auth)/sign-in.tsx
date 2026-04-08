import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CosmicBackground } from "@/components/CosmicBackground";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { getFirebaseAuth } from "@/lib/firebase";
import { writePersistedValue } from "@/lib/storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { themes, typography } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const theme = themes.dark;

const getFirebaseAuthErrorCode = (err: unknown): string | null => {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return null;
};

const isValidEmailFormat = (raw: string): boolean => {
  const v = raw.trim();
  if (!v || !v.includes("@")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

type AuthEmailFlow = "login" | "register";

const parseWelcomeMode = (raw: string | string[] | undefined): AuthEmailFlow => {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "register" ? "register" : "login";
};

/**
 * Email sign-in or register on one screen. `auth-options` passes `mode=login|register`; no in-form toggle — use back to change method.
 */
export default function EmailSignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = i18n.language === "fa";
  const { user, loading } = useFirebaseAuth();
  const [flow, setFlow] = useState<AuthEmailFlow>(() => parseWelcomeMode(params.mode));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const narrowCtaWidth = Math.min(width - 48, 320);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setFlow(parseWelcomeMode(params.mode));
  }, [params.mode]);

  const runSignIn = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const e = email.trim();
      if (!e || !password) {
        setError(t("auth.errors.emailPassword"));
        return;
      }
      if (Platform.OS === "web") {
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        const cred = await signInWithEmailAndPassword(
          getFirebaseAuth() as import("firebase/auth").Auth,
          e,
          password,
        );
        await syncAuthUserToBackend(cred.user);
        await writePersistedValue("akhtar.lastAuthMethod", "password");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const cred = await nativeAuth().signInWithEmailAndPassword(e, password);
        await syncAuthUserToBackend(cred.user);
        await writePersistedValue("akhtar.lastAuthMethod", "password");
      }
      router.replace("/");
    } catch (err) {
      const code = getFirebaseAuthErrorCode(err);
      if (code === "auth/account-exists-with-different-credential") {
        setError(t("auth.accountExistsDifferentMethod"));
      } else if (code === "auth/invalid-email") {
        setError(t("auth.errors.invalidEmail"));
      } else {
        setError(t("auth.errors.signInFailed"));
      }
    } finally {
      setBusy(false);
    }
  }, [email, password, router, t]);

  const runRegister = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const e = email.trim();
      if (!e || !password || !confirmPassword) {
        setError(t("auth.errors.formIncomplete"));
        return;
      }
      if (password.length < 6) {
        setError(t("auth.errors.registerInvalid"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("auth.errors.passwordMismatch"));
        return;
      }
      if (Platform.OS === "web") {
        const { createUserWithEmailAndPassword } = await import("firebase/auth");
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth() as import("firebase/auth").Auth,
          e,
          password,
        );
        await syncAuthUserToBackend(cred.user);
        await writePersistedValue("akhtar.lastAuthMethod", "password");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const cred = await nativeAuth().createUserWithEmailAndPassword(e, password);
        await syncAuthUserToBackend(cred.user);
        await writePersistedValue("akhtar.lastAuthMethod", "password");
      }
      router.replace("/");
    } catch (err) {
      const code = getFirebaseAuthErrorCode(err);
      if (code === "auth/email-already-in-use") {
        setError(t("auth.errors.registerFailed"));
      } else if (code === "auth/weak-password") {
        setError(t("auth.errors.registerInvalid"));
      } else if (code === "auth/invalid-email") {
        setError(t("auth.errors.registerInvalid"));
      } else {
        setError(t("auth.errors.registerFailed"));
      }
    } finally {
      setBusy(false);
    }
  }, [confirmPassword, email, password, router, t]);

  const openResetModal = useCallback(() => {
    setResetEmail(email.trim());
    setResetError("");
    setResetSuccess(false);
    setResetBusy(false);
    setResetModalVisible(true);
  }, [email]);

  const closeResetModal = useCallback(() => {
    setResetModalVisible(false);
    setResetError("");
    setResetBusy(false);
    setResetSuccess(false);
  }, []);

  const sendPasswordReset = useCallback(async () => {
    setResetError("");
    const e = resetEmail.trim();
    if (!isValidEmailFormat(e)) {
      setResetError(t("auth.resetPassword.errorInvalidEmail"));
      return;
    }
    setResetBusy(true);
    try {
      if (Platform.OS === "web") {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        await sendPasswordResetEmail(getFirebaseAuth() as import("firebase/auth").Auth, e);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        await nativeAuth().sendPasswordResetEmail(e);
      }
      setResetSuccess(true);
    } catch (err) {
      const code = getFirebaseAuthErrorCode(err);
      if (code === "auth/user-not-found") {
        setResetSuccess(true);
      } else {
        setResetError(t("auth.resetPassword.errorGeneric"));
      }
    } finally {
      setResetBusy(false);
    }
  }, [resetEmail, t]);

  const haptic = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const textAlignStyle = { textAlign: (rtl ? "right" : "left") as "right" | "left", writingDirection: (rtl ? "rtl" : "ltr") as "rtl" | "ltr" };

  if (loading && !user) {
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
              router.replace("/welcome");
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
              className="mb-6 text-2xl font-semibold"
              style={{
                color: theme.colors.onBackground,
                fontFamily: typography.family.semibold,
                ...textAlignStyle,
              }}
            >
              {flow === "register" ? t("auth.createAccount") : t("auth.signIn")}
            </Text>

            <View
              className="rounded-3xl border p-4"
              style={{
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
              }}
            >
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                placeholder={t("auth.email")}
                placeholderTextColor={theme.colors.onSurfaceVariant}
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
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t("auth.password")}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                secureTextEntry
                autoComplete={flow === "register" ? "password-new" : "password"}
                textContentType={flow === "register" ? "newPassword" : "password"}
                editable={!busy}
                className="mt-3 rounded-2xl px-4 py-3.5 text-base"
                style={{
                  color: theme.colors.onBackground,
                  backgroundColor: theme.colors.surfaceVariant,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  ...textAlignStyle,
                }}
              />
              {flow === "register" ? (
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t("auth.confirmPassword")}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  secureTextEntry
                  autoComplete="password-new"
                  textContentType="newPassword"
                  editable={!busy}
                  className="mt-3 rounded-2xl px-4 py-3.5 text-base"
                  style={{
                    color: theme.colors.onBackground,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    ...textAlignStyle,
                  }}
                />
              ) : (
                <View className="mt-2 self-end rtl:self-start">
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => {
                      haptic();
                      if (!busy) openResetModal();
                    }}
                    hitSlop={8}
                  >
                    <Text className="text-sm leading-5" style={{ color: theme.colors.primary, fontFamily: typography.family.medium }}>
                      {t("auth.forgotPassword")}
                    </Text>
                  </Pressable>
                </View>
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
                  if (flow === "register") void runRegister();
                  else void runSignIn();
                }}
                className="mt-6 min-h-[48px] items-center justify-center self-center rounded-2xl px-5 py-3"
                style={{
                  backgroundColor: theme.colors.primary,
                  opacity: busy ? 0.65 : 1,
                  width: narrowCtaWidth,
                }}
              >
                <Text className="text-base font-semibold" style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}>
                  {busy
                    ? t("common.ellipsis")
                    : flow === "register"
                      ? t("auth.createAccount")
                      : t("auth.signIn")}
                </Text>
              </Pressable>
            </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetModalVisible} transparent animationType="fade" onRequestClose={closeResetModal}>
        <View className="flex-1 justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
          <Pressable accessibilityRole="button" className="absolute inset-0" onPress={closeResetModal} />
          <View
            className="relative z-10 w-full max-w-md self-center rounded-3xl border p-4"
            style={{
              borderColor: theme.colors.outline,
              backgroundColor: theme.colors.surface,
            }}
          >
            <View className="mb-3 flex-row items-center justify-between" style={{ flexDirection: rtl ? "row-reverse" : "row" }}>
              <Text
                className="flex-1 pr-2 text-lg font-semibold rtl:pl-2 rtl:pr-0"
                style={{
                  color: theme.colors.onBackground,
                  fontFamily: typography.family.semibold,
                  ...textAlignStyle,
                }}
              >
                {t("auth.resetPassword.title")}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} hitSlop={12} onPress={closeResetModal}>
                <Ionicons name="close" size={26} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>

            {resetSuccess ? (
              <Text className="text-base leading-6" style={{ color: theme.colors.onBackground, fontFamily: typography.family.regular, ...textAlignStyle }}>
                {t("auth.resetEmailSent")}
              </Text>
            ) : (
              <>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  placeholder={t("auth.email")}
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  editable={!resetBusy}
                  className="rounded-2xl px-4 py-3.5 text-base"
                  style={{
                    color: theme.colors.onBackground,
                    backgroundColor: theme.colors.surfaceVariant,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    ...textAlignStyle,
                  }}
                />
                {resetError ? (
                  <Text className="mt-2 text-sm leading-5" style={{ color: theme.colors.error, ...textAlignStyle }}>
                    {resetError}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={resetBusy}
                  onPress={() => {
                    haptic();
                    if (!resetBusy) void sendPasswordReset();
                  }}
                  className="mt-4 min-h-[48px] items-center justify-center self-center rounded-2xl px-5 py-3"
                  style={{
                    backgroundColor: theme.colors.primary,
                    opacity: resetBusy ? 0.65 : 1,
                    width: narrowCtaWidth,
                  }}
                >
                  {resetBusy ? (
                    <ActivityIndicator color={theme.colors.onPrimary} />
                  ) : (
                    <Text className="text-base font-semibold" style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}>
                      {t("auth.sendResetLink")}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
