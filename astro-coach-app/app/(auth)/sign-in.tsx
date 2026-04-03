import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SignInHeroPanel } from "@/components/auth/SignInHeroPanel";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { LanguageSelector } from "@/components/LanguageSelector";
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
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { themes, typography } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const WIDE_SPLIT_MIN_WIDTH = 840;

/** Sign-in always uses dark theme tokens (hero + form); app preference unchanged after navigation. */
const theme = themes.dark;

/**
 * Email/password + Google sign-in (Firebase). Wide screens: form left, animated hero right.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = i18n.language === "fa";
  const { user, loading } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isWideSplit = width >= WIDE_SPLIT_MIN_WIDTH;

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

  const formCard = (
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
        <Text className="mt-3 text-sm leading-5" style={{ color: theme.colors.error, writingDirection: rtl ? "rtl" : "ltr" }}>
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
        <Text className="text-base font-semibold" style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}>
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
        <Text className="text-base font-semibold" style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}>
          {t("auth.createAccount")}
        </Text>
      </Pressable>
    </View>
  );

  const formBlock = (
    <>
      <View className="mb-5 items-center">
        <AkhtarWordmark size="home" />
      </View>
      <Text
        className="mb-6 text-3xl font-semibold"
        style={{
          color: theme.colors.onBackground,
          fontFamily: typography.family.semibold,
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {t("auth.signIn")}
      </Text>
      {formCard}
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
        <Text className="text-base font-semibold" style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}>
          {busy ? "…" : t("auth.continueWithGoogle")}
        </Text>
      </Pressable>
    </>
  );

  const langOverlayBelowStatusBar = (
    <View
      className="absolute right-4 z-10"
      style={{ top: Math.max(insets.top, 8) + 8 }}
      pointerEvents="box-none"
    >
      <LanguageSelector variant="pills" />
    </View>
  );

  const langOverlayInSafeArea = (
    <View className="absolute right-4 top-2 z-10" pointerEvents="box-none">
      <LanguageSelector variant="pills" />
    </View>
  );

  if (loading && !user) {
    return (
      <View className="relative flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        {langOverlayBelowStatusBar}
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (isWideSplit) {
    return (
      <SafeAreaView className="relative flex-1" style={{ backgroundColor: theme.colors.background }} edges={["top", "left", "right"]}>
        {langOverlayInSafeArea}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <View className="flex-1 flex-row" style={{ flexDirection: rtl ? "row-reverse" : "row" }}>
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                paddingHorizontal: 40,
                paddingVertical: 32,
                maxWidth: 520,
                width: "100%",
                alignSelf: rtl ? "flex-end" : "flex-start",
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {formBlock}
            </ScrollView>
            <View className="flex-1" style={{ minWidth: 0 }}>
              <SignInHeroPanel theme={theme} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="relative flex-1" style={{ backgroundColor: theme.colors.background }} edges={["top", "left", "right"]}>
      {langOverlayInSafeArea}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {formBlock}
          <SignInHeroPanel theme={theme} compact />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
