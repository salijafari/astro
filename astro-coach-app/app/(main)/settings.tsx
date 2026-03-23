import { useAuth } from "@/lib/auth";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/providers/ThemeProvider";
import { removePersistedValue } from "@/lib/storage";
import { ONBOARDING_LANG_SELECTED_KEY, changeLanguage } from "@/lib/i18n";
import { restorePurchasesAccess } from "@/lib/purchases";

function SectionHeader({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <Text
      className="mb-2 mt-8 px-1 text-xs font-medium uppercase tracking-widest"
      style={{ color: theme.colors.onSurfaceVariant }}
    >
      {label}
    </Text>
  );
}

function Row({
  label,
  onPress,
  showDivider,
  destructive,
}: {
  label: string;
  onPress: () => void;
  showDivider: boolean;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const fg = destructive ? theme.colors.error : theme.colors.onBackground;
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[52px] flex-row items-center justify-between px-4 py-3"
      style={{
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: theme.colors.outlineVariant,
      }}
    >
      <Text className="text-lg font-medium" style={{ color: fg }}>
        {label}
      </Text>
      <Text className="text-xl" style={{ color: fg }}>
        ›
      </Text>
    </Pressable>
  );
}

export default function SettingsMainScreen() {
  const { t, i18n } = useTranslation();
  const { theme, isDark, preference, setPreference } = useTheme();
  const { signOut, getToken } = useAuth();
  const router = useRouter();
  const [notifyDaily, setNotifyDaily] = useState(true);
  const [notifyMoon, setNotifyMoon] = useState(false);

  const onDelete = async () => {
    const base = process.env.EXPO_PUBLIC_API_URL ?? "";
    const token = await getToken();
    await fetch(`${base}/api/user/account`, { method: "DELETE", headers: { authorization: `Bearer ${token ?? ""}` } }).catch(() => null);
    await signOut();
    await removePersistedValue(ONBOARDING_LANG_SELECTED_KEY);
    router.replace("/(onboarding)/language-select");
  };

  const restore = async () => {
    try {
      if (Platform.OS !== "web") await restorePurchasesAccess();
      Alert.alert(t("settings.restoreDone"));
    } catch {
      Alert.alert(t("settings.restoreFailed"));
    }
  };

  return (
    <View className="flex-1 px-4 pb-10" style={{ backgroundColor: theme.colors.background }}>
      <Text className="mb-2 pt-2 text-center text-3xl font-semibold" style={{ color: theme.colors.onBackground }}>
        {t("settings.title")}
      </Text>

      <SectionHeader label={t("settings.sectionProfile")} />
      <View className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.colors.outline }}>
        <Row
          label={t("settings.editInfo")}
          onPress={() => router.push("/(onboarding)/chat-onboarding")}
          showDivider={false}
        />
      </View>

      <SectionHeader label={t("settings.sectionSubscription")} />
      <View className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.colors.outline }}>
        <Row
          label={t("settings.manageSubscription")}
          onPress={() => {
            if (Platform.OS === "web") {
              const base = process.env.EXPO_PUBLIC_API_URL ?? "";
              void Linking.openURL(`${base}/billing/portal`);
              return;
            }
            void Linking.openURL("https://apps.apple.com/account/subscriptions");
          }}
          showDivider={Platform.OS !== "web"}
        />
        {Platform.OS !== "web" ? (
          <Row label={t("settings.restorePurchases")} onPress={() => void restore()} showDivider={false} />
        ) : null}
      </View>

      <SectionHeader label={t("settings.notifications")} />
      <View className="overflow-hidden rounded-2xl border px-4 py-3" style={{ borderColor: theme.colors.outline }}>
        <View className="min-h-[48px] flex-row items-center justify-between py-2">
          <Text className="flex-1 pr-4 text-lg" style={{ color: theme.colors.onBackground }}>
            {t("settings.notificationsDaily")}
          </Text>
          <Switch
            value={notifyDaily}
            onValueChange={setNotifyDaily}
            trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
            thumbColor={theme.colors.onBackground}
          />
        </View>
        <View className="h-px w-full" style={{ backgroundColor: theme.colors.outlineVariant }} />
        <View className="min-h-[48px] flex-row items-center justify-between py-2">
          <Text className="flex-1 pr-4 text-lg" style={{ color: theme.colors.onBackground }}>
            {t("settings.moonAlerts")}
          </Text>
          <Switch
            value={notifyMoon}
            onValueChange={setNotifyMoon}
            trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
            thumbColor={theme.colors.onBackground}
          />
        </View>
      </View>

      <SectionHeader label={t("settings.sectionAppearance")} />
      <View className="overflow-hidden rounded-2xl border px-4 py-4" style={{ borderColor: theme.colors.outline }}>
        <View className="min-h-[48px] flex-row items-center justify-between">
          <Text className="text-lg" style={{ color: theme.colors.onBackground }}>
            {t("settings.language")}
          </Text>
          <Pressable onPress={() => void changeLanguage(i18n.language === "fa" ? "en" : "fa")} className="rounded-full border px-4 py-2" style={{ borderColor: theme.colors.outline }}>
            <Text style={{ color: theme.colors.primary }}>{i18n.language === "fa" ? t("language.farsi") : t("language.english")}</Text>
          </Pressable>
        </View>
        <View className="my-3 h-px w-full" style={{ backgroundColor: theme.colors.outlineVariant }} />
        <View className="min-h-[48px] flex-row items-center justify-between">
          <Text className="text-lg" style={{ color: theme.colors.onBackground }}>
            {isDark ? t("settings.dark") : t("settings.light")}
          </Text>
          <Switch
            value={isDark}
            onValueChange={() => void setPreference(isDark ? "light" : "dark")}
            trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
            thumbColor={theme.colors.onBackground}
          />
        </View>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(["system", "light", "dark"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => void setPreference(mode)}
              className="rounded-full border px-3 py-2"
              style={{
                borderColor: preference === mode ? theme.colors.primary : theme.colors.outline,
                backgroundColor: preference === mode ? theme.colors.primaryContainer : "transparent",
              }}
            >
              <Text className="text-sm font-medium" style={{ color: theme.colors.onBackground }}>
                {mode === "system" ? t("settings.system") : mode === "light" ? t("settings.light") : t("settings.dark")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <SectionHeader label={t("settings.sectionSupport")} />
      <View className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.colors.outline }}>
        <Row
          label={t("settings.contact")}
          onPress={() => void Linking.openURL("mailto:astracontact111@gmail.com")}
          showDivider
        />
        <Row label={t("settings.shareDebug")} onPress={() => void Linking.openURL("mailto:astracontact111@gmail.com?subject=Debug")} showDivider={false} />
      </View>

      <SectionHeader label={t("settings.sectionLegal")} />
      <View className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.colors.outline }}>
        <Row
          label={t("settings.terms")}
          onPress={() => void WebBrowser.openBrowserAsync("https://example.com/terms")}
          showDivider
        />
        <Row label={t("settings.privacy")} onPress={() => void WebBrowser.openBrowserAsync("https://example.com/privacy")} showDivider={false} />
      </View>

      <View className="mt-10 overflow-hidden rounded-2xl border" style={{ borderColor: theme.colors.error }}>
        <Row label={t("settings.deleteAccount")} onPress={() => void onDelete()} showDivider={false} destructive />
      </View>
    </View>
  );
}
