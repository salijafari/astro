import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SignInHeroPanel } from "@/components/auth/SignInHeroPanel";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";

WebBrowser.maybeCompleteAuthSession();

const WIDE_SPLIT_MIN_WIDTH = 840;

/** Mystical sign-in palette (matches product marketing / reference design). */
const C = {
  bg: "#050505",
  glassBg: "rgba(15, 23, 42, 0.72)",
  glassBorder: "rgba(212, 175, 55, 0.42)",
  gold: "#D4AF37",
  goldDim: "#A67C00",
  textWarm: "#F5E6C8",
  textMuted: "#A8A29E",
  inputBg: "rgba(30, 41, 59, 0.92)",
  inputBorder: "rgba(212, 175, 55, 0.22)",
  googleBg: "rgba(30, 41, 59, 0.95)",
  googleBorder: "rgba(148, 163, 184, 0.35)",
  error: "#f87171",
};

function useSerifTitle(rtl: boolean) {
  return useMemo(
    () =>
      rtl
        ? typography.family.semibold
        : Platform.select({ ios: "Georgia", android: "serif", web: "Georgia, Palatino, serif" }) ?? "serif",
    [rtl],
  );
}

function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 52 }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        top: `${(i * 53 + 7) % 100}%`,
        opacity: 0.12 + (i % 7) * 0.06,
        size: i % 4 === 0 ? 2.5 : 1.5,
      })),
    [],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      {stars.map((s, i) => (
        <View
          // eslint-disable-next-line react/no-array-index-key -- static decorative pattern
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: C.gold,
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

function GlassCorner({ cornerStyle }: { cornerStyle: ViewStyle }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: 22,
          height: 22,
          borderColor: C.gold,
          opacity: 0.55,
        },
        cornerStyle,
      ]}
    />
  );
}

/**
 * Email/password + Google sign-in (Firebase). Wide screens: form left, hero art right.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = i18n.language === "fa";
  const serifTitle = useSerifTitle(rtl);
  const { user, loading } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isWideSplit = width >= WIDE_SPLIT_MIN_WIDTH;

  const glassExtra: ViewStyle =
    Platform.OS === "web"
      ? ({
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: "0 0 48px rgba(212, 175, 55, 0.07)",
        } as ViewStyle)
      : {};

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

  const onForgotPassword = useCallback(async () => {
    const e = email.trim();
    if (!e) {
      setError(t("auth.emailRequiredForReset"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (Platform.OS === "web") {
        const { sendPasswordResetEmail } = await import("firebase/auth");
        await sendPasswordResetEmail(getFirebaseAuth() as import("firebase/auth").Auth, e);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nativeAuth = require("@react-native-firebase/auth").default as typeof import("@react-native-firebase/auth").default;
        await nativeAuth().sendPasswordResetEmail(e);
      }
      Alert.alert(t("auth.resetEmailSent"));
    } catch {
      setError(t("auth.resetFailed"));
    } finally {
      setBusy(false);
    }
  }, [email, t]);

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
      style={[
        {
          borderRadius: 22,
          borderWidth: 1,
          borderColor: C.glassBorder,
          backgroundColor: C.glassBg,
          paddingHorizontal: 20,
          paddingVertical: 22,
          position: "relative",
          overflow: "visible",
        },
        glassExtra,
      ]}
    >
      <GlassCorner cornerStyle={{ top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 0, borderBottomWidth: 0 }} />
      <GlassCorner cornerStyle={{ top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2, borderLeftWidth: 0, borderBottomWidth: 0 }} />
      <GlassCorner cornerStyle={{ bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 0, borderTopWidth: 0 }} />
      <GlassCorner cornerStyle={{ bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2, borderLeftWidth: 0, borderTopWidth: 0 }} />

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        placeholder={t("auth.email")}
        placeholderTextColor={C.textMuted}
        editable={!busy}
        className="rounded-2xl px-4 py-4 text-base"
        style={{
          fontSize: 16,
          color: C.textWarm,
          backgroundColor: C.inputBg,
          borderWidth: 1,
          borderColor: C.inputBorder,
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
          fontFamily: rtl ? typography.family.regular : undefined,
        }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t("auth.password")}
        placeholderTextColor={C.textMuted}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        editable={!busy}
        onSubmitEditing={() => {
          if (!busy) void runSignIn();
        }}
        returnKeyType="go"
        className="mt-3 rounded-2xl px-4 py-4 text-base"
        style={{
          fontSize: 16,
          color: C.textWarm,
          backgroundColor: C.inputBg,
          borderWidth: 1,
          borderColor: C.inputBorder,
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
          fontFamily: rtl ? typography.family.regular : undefined,
        }}
      />

      {error ? (
        <Text className="mt-3 text-sm leading-5" style={{ color: C.error, writingDirection: rtl ? "rtl" : "ltr" }}>
          {error}
        </Text>
      ) : null}

      <LinearGradient
        colors={["#E8C547", "#A855F7", "#6B21A8"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ marginTop: 22, borderRadius: 9999, overflow: "hidden", opacity: busy ? 0.65 : 1 }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            haptic();
            if (!busy) void runSignIn();
          }}
          className="min-h-[52px] items-center justify-center px-6 py-3.5"
        >
          <Text style={{ color: "#0a0a0a", fontSize: 17, fontWeight: "700", fontFamily: rtl ? typography.family.bold : undefined }}>
            {busy ? "…" : t("auth.signIn")}
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );

  const footerLinks = (
    <View
      className="mt-8 flex-row flex-wrap items-center justify-center gap-x-2 gap-y-2 px-1"
      style={{ flexDirection: rtl ? "row-reverse" : "row" }}
    >
      <Pressable onPress={() => void onForgotPassword()} disabled={busy} hitSlop={8}>
        <Text className="text-sm underline" style={{ color: C.textMuted }}>
          {t("auth.forgotPassword")}
        </Text>
      </Pressable>
      <Text style={{ color: C.textMuted, opacity: 0.5 }}>·</Text>
      <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://example.com/terms")} hitSlop={8}>
        <Text className="text-sm underline" style={{ color: C.textMuted }}>
          {t("settings.terms")}
        </Text>
      </Pressable>
      <Text style={{ color: C.textMuted, opacity: 0.5 }}>·</Text>
      <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://example.com/privacy")} hitSlop={8}>
        <Text className="text-sm underline" style={{ color: C.textMuted }}>
          {t("settings.privacy")}
        </Text>
      </Pressable>
    </View>
  );

  const formBlock = (
    <>
      <Text
        style={{
          color: C.gold,
          fontSize: 15,
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 10,
          textAlign: rtl ? "right" : "left",
          fontFamily: rtl ? typography.family.semibold : undefined,
        }}
      >
        {t("brand.name")}
      </Text>
      <Text
        className="mb-8 text-4xl"
        style={{
          color: C.textWarm,
          fontFamily: serifTitle,
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {t("auth.signIn")}
      </Text>

      {formCard}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          haptic();
          if (!busy) void runRegister();
        }}
        className="mt-6 items-center py-2"
        style={{ opacity: busy ? 0.5 : 1 }}
      >
        <Text
          className="text-base underline"
          style={{
            color: C.textWarm,
            fontFamily: rtl ? typography.family.semibold : undefined,
          }}
        >
          {t("auth.createAccount")}
        </Text>
      </Pressable>

      <View className="my-8 flex-row items-center gap-x-3" style={{ flexDirection: rtl ? "row-reverse" : "row" }}>
        <View className="h-px flex-1" style={{ backgroundColor: "rgba(212, 175, 55, 0.25)" }} />
        <Text style={{ color: C.textMuted, fontSize: 13 }}>{t("auth.orDivider")}</Text>
        <View className="h-px flex-1" style={{ backgroundColor: "rgba(212, 175, 55, 0.25)" }} />
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => {
          haptic();
          if (!busy) void onGoogle();
        }}
        className="min-h-[52px] flex-row items-center justify-center gap-3 rounded-full border px-5 py-3.5"
        style={{
          borderColor: C.googleBorder,
          backgroundColor: C.googleBg,
          opacity: busy ? 0.65 : 1,
          flexDirection: rtl ? "row-reverse" : "row",
        }}
      >
        <Ionicons name="logo-google" size={22} color={C.goldDim} />
        <Text
          className="text-base font-semibold"
          style={{
            color: C.textWarm,
            fontFamily: rtl ? typography.family.semibold : undefined,
          }}
        >
          {busy ? "…" : t("auth.continueWithGoogle")}
        </Text>
      </Pressable>

      {footerLinks}
    </>
  );

  if (loading && !user) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: C.bg }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  const shell = (
    <View className="flex-1" style={{ backgroundColor: C.bg }}>
      <Starfield />
      {isWideSplit ? (
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
              <SignInHeroPanel />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formBlock}
            <SignInHeroPanel compact />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: C.bg }} edges={["top", "left", "right"]}>
      {shell}
    </SafeAreaView>
  );
}
