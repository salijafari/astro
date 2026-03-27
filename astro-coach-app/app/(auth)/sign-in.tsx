import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { typography } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

/**
 * Email/password sign-in via Firebase (Google uses the same Firebase project).
 * Visual language matches `/(main)/home` (brand hero + theme tokens).
 */
export default function SignInScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const rtl = i18n.language === "fa";
  const { user, loading } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

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
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        const cred = await nativeAuth().signInWithEmailAndPassword(e, password);
        await syncAuthUserToBackend(cred.user);
      }
      router.replace("/");
    } catch {
      setError(t("auth.errors.signInFailed"));
    } finally {
      setBusy(false);
    }
  }, [email, password, router, t]);

  const runRegister = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const e = email.trim();
      if (!e || !password || password.length < 6) {
        setError(t("auth.errors.registerInvalid"));
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
    } catch {
      setError(t("auth.errors.registerFailed"));
    } finally {
      setBusy(false);
    }
  }, [email, password, router, t]);

  const onGoogle = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        await syncAuthUserToBackend(signedInUser);
        router.replace("/");
      }
    } catch (googleError) {
      console.error("Google sign-in error:", googleError);
      setError(t("auth.errors.googleFailed"));
    } finally {
      setBusy(false);
    }
  }, [router, t]);

  const haptic = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  if (loading && !user) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center pb-6 pt-4">
            <LinearGradient
              colors={[`${theme.colors.primary}aa`, `${theme.colors.secondary}55`, "transparent"]}
              locations={[0, 0.45, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 52, lineHeight: 56, color: theme.colors.onBackground }}>✦</Text>
            </LinearGradient>

            <View className="mb-3 flex-row items-center justify-center gap-x-3">
              {["·", "✦", "·", "·", "✦", "·"].map((c, i) => (
                <Text key={i} className="text-sm" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.9 }}>
                  {c}
                </Text>
              ))}
            </View>
            <Text
              className="text-center text-4xl tracking-wide"
              style={{
                color: theme.colors.onBackground,
                fontFamily: typography.family.semibold,
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >
              {t("brand.name")}
            </Text>
            <View className="mt-3 flex-row items-center justify-center gap-x-2 opacity-70">
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>✦</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 8 }}>·</Text>
              <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}>✦</Text>
            </View>
          </View>

          <Text
            className="text-center text-2xl font-semibold"
            style={{
              color: theme.colors.onBackground,
              fontFamily: typography.family.semibold,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("auth.welcomeBack")}
          </Text>
          <Text
            className="mt-2 px-2 text-center text-base leading-6"
            style={{
              color: theme.colors.onSurfaceVariant,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("auth.subtitle")}
          </Text>

          <View
            className="mt-8 rounded-3xl border p-4"
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
              className="rounded-2xl px-4 py-4 text-base"
              style={{
                color: theme.colors.onBackground,
                backgroundColor: theme.colors.surfaceVariant,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.password")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              editable={!busy}
              className="mt-3 rounded-2xl px-4 py-4 text-base"
              style={{
                color: theme.colors.onBackground,
                backgroundColor: theme.colors.surfaceVariant,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            />

            {error ? (
              <Text
                className="mt-3 text-sm leading-5"
                style={{ color: theme.colors.error, writingDirection: rtl ? "rtl" : "ltr" }}
              >
                {error}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                haptic();
                if (!busy) void runSignIn();
              }}
              className="mt-6 min-h-[48px] items-center justify-center rounded-2xl px-5 py-3"
              style={{ backgroundColor: theme.colors.primary, opacity: busy ? 0.65 : 1 }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}
              >
                {busy ? "…" : t("auth.signIn")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                haptic();
                if (!busy) void runRegister();
              }}
              className="mt-3 min-h-[48px] items-center justify-center rounded-2xl border px-5 py-3"
              style={{ borderColor: theme.colors.outline, opacity: busy ? 0.65 : 1 }}
            >
              <Text
                className="text-base font-semibold"
                style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}
              >
                {t("auth.createAccount")}
              </Text>
            </Pressable>
          </View>

          <View className="my-8 flex-row items-center gap-x-3">
            <View className="h-px flex-1" style={{ backgroundColor: theme.colors.outlineVariant }} />
            <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 13 }}>{t("auth.orDivider")}</Text>
            <View className="h-px flex-1" style={{ backgroundColor: theme.colors.outlineVariant }} />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              haptic();
              if (!busy) void onGoogle();
            }}
            className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-2xl border px-5 py-3"
            style={{
              borderColor: theme.colors.outline,
              opacity: busy ? 0.65 : 1,
              flexDirection: rtl ? "row-reverse" : "row",
            }}
          >
            <Ionicons name="logo-google" size={22} color={theme.colors.onBackground} />
            <Text
              className="text-base font-semibold"
              style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}
            >
              {busy ? "…" : t("auth.continueWithGoogle")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
