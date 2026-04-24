import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CosmicBackground } from "@/components/CosmicBackground";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { getFirebaseAuth } from "@/lib/firebase";
import { isPersian } from "@/lib/i18n";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
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

/**
 * Email registration with confirm password. Entry: `welcome` → "Create your account".
 */
export default function EmailRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = isPersian(i18n.language);
  const { user, loading } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const narrowCtaWidth = Math.min(width - 48, 320);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

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
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const cred = await nativeAuth().createUserWithEmailAndPassword(e, password);
        await syncAuthUserToBackend(cred.user);
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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 20), paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic();
              router.replace("/welcome");
            }}
            className="mb-4 min-h-[44px] flex-row items-center gap-2 py-2"
            hitSlop={8}
            style={{ flexDirection: rtl ? "row-reverse" : "row" }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.primary} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
            <Text className="text-base font-semibold" style={{ color: theme.colors.primary, fontFamily: typography.family.semibold }}>
              {t("common.back")}
            </Text>
          </Pressable>

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
            {t("auth.createAccount")}
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
                if (!busy) void runRegister();
              }}
              className="mt-6 min-h-[48px] items-center justify-center self-center rounded-2xl px-5 py-3"
              style={{
                backgroundColor: theme.colors.primary,
                opacity: busy ? 0.65 : 1,
                width: narrowCtaWidth,
              }}
            >
              <Text className="text-base font-semibold" style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}>
                {busy ? t("common.ellipsis") : t("auth.createAccount")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
