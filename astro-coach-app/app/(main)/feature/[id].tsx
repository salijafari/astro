import * as Haptics from "expo-haptics";
import { useHeaderHeight } from "@react-navigation/elements";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVoiceMode } from "@/lib/useVoiceMode";
import { VoiceInputBar } from "@/components/voice/VoiceInputBar";
import { VoiceListeningOverlay } from "@/components/voice/VoiceListeningOverlay";
import { VoiceWaveIcon } from "@/components/voice/VoiceWaveIcon";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { AuroraSafeArea, type AuroraSafeAreaProps } from "@/components/CosmicBackground";
import { apiGetJson, apiPostJson, getMantraJournalPage, type MantraJournalEntry } from "@/lib/api";
import { logEvent } from "@/lib/analytics";
import { MANTRA_UX_KEYS, readMantraUx, writeMantraUx } from "@/lib/mantraUxStorage";
import { useAuth } from "@/lib/auth";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { Button } from "@/components/ui/Button";
import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { CompatibilityChipRow } from "@/components/compatibility/CompatibilityChipRow";
import {
  CompatibilityInsightCard,
  type CompatibilityReportPayload,
} from "@/components/compatibility/CompatibilityInsightCard";
import { CompatibilityProfileContextCard } from "@/components/compatibility/CompatibilityProfileContextCard";
import { getFeatureConfig } from "@/lib/featureConfig";
import { useThemeColors } from "@/lib/themeColors";
import { useStreamingChat, type StreamingChatMessage } from "@/lib/useStreamingChat";
import { useTheme } from "@/providers/ThemeProvider";
import { useTranslation } from "react-i18next";
import { ChatComposerBar } from "@/components/chat/ChatComposerBar";
import {
  CHAT_KAV_HEADER_OFFSET_IOS,
  useChatScreenHorizontalPadding,
} from "@/constants/chatLayout";
import { useBottomNavInset } from "@/hooks/useBottomNavInset";

const dreamChatApiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

/**
 * Clears the transparent tab header (`feature/[id]`) without clipping the aurora (CosmicBackground is absolute fill).
 */
function FeatureAuroraSafeArea({
  children,
  className,
  style,
  colorSchemeOverride,
}: Omit<AuroraSafeAreaProps, "edges">) {
  const headerH = useHeaderHeight();
  const bottomInset = useBottomNavInset();
  return (
    <AuroraSafeArea
      colorSchemeOverride={colorSchemeOverride}
      className={className}
      style={[{ paddingTop: headerH, paddingBottom: bottomInset }, style]}
      edges={["left", "right"]}
    >
      {children}
    </AuroraSafeArea>
  );
}

/** Legacy dashboard route `tarot-interpreter` → dedicated tarot stack. */
function TarotInterpreterEntryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/(main)/tarot" as Href);
  }, [router]);
  return null;
}

const FEATURE_KEY_BY_ID: Record<string, string> = {
  "ask-anything": "features.askAnything",
  "daily-horoscope": "features.dailyHoroscope",
  "romantic-compatibility": "features.romanticCompatibility",
  "conflict-advice": "features.conflictAdvice",
  "life-challenges": "features.lifeChallenges",
  "personal-growth": "features.personalGrowth",
  "astrological-events": "features.astrologicalEvents",
  "tarot-interpreter": "features.tarotInterpreter",
  "coffee-reading": "features.coffeeReading",
  "future-seer": "features.futureSeer",
  "dream-interpreter": "features.dreamInterpreter",
};

type FeatureParams = {
  id: string;
  prefill?: string;
};

type DailyHoroscope = {
  title: string;
  body: string;
  moodLabel: string;
  affirmation?: string | null;
  focusArea?: string | null;
  date?: string;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type PeopleProfileRow = {
  id: string;
  name: string;
  relationshipType: string;
  hasFullData: boolean;
  birthDate?: string | Date;
};

function DailyHoroscopeFeature({ onAsk }: { onAsk: (prefill: string) => void }) {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const hPad = useChatScreenHorizontalPadding();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DailyHoroscope | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetJson<DailyHoroscope>("/api/horoscope/today", getToken);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-4">{t("common.tryAgain") ?? "Could not load today"}</Text>
<Text style={{ color: tc.textSecondary }} >{error}</Text>
          <Button title={t("common.tryAgain") ?? "Try again"} onPress={() => void load()} className="mt-4" />
        </View>
      ) : data ? (
        <View className="flex-1">
          <View className="rounded-xl border border-indigo-800 p-4">
            <View className="mb-2 flex-row items-center justify-between">
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-xs uppercase tracking-wide">{data.moodLabel}</Text>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  onAsk(`Tell me more about my daily horoscope: ${data.title}`);
                }}
                className="min-h-[48px] justify-center rounded-[20px] px-3 py-2"
                style={{ backgroundColor: theme.colors.surface }}
              >
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm">Ask Akhtar</Text>
              </Pressable>
            </View>
<Text style={{ color: tc.textPrimary }} className="mb-2 text-2xl font-bold">{data.title}</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{data.body}</Text>
          </View>
        </View>
      ) : null}
    </FeatureAuroraSafeArea>
  );
}

type CompatTailRow =
  | { id: string; tailKind: "loading"; text: string }
  | { id: string; tailKind: "insight"; report: CompatibilityReportPayload }
  | { id: string; tailKind: "tail_chips"; prompts: string[] };

type CompatListRow =
  | { rowKind: "msg"; message: StreamingChatMessage }
  | { rowKind: "selector" }
  | { rowKind: "profile" }
  | { rowKind: "starter_chips" }
  | { rowKind: "tail"; tail: CompatTailRow };

function CompatibilityFeature() {
  const { getToken } = useAuth();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const rtl = i18n.language === "fa";
  const hPad = useChatScreenHorizontalPadding();
  const paramsCompat = useLocalSearchParams<{ autoSelectPersonId?: string | string[] }>();
  const rawAutoId = paramsCompat.autoSelectPersonId;
  const autoSelectPersonId = Array.isArray(rawAutoId) ? rawAutoId[0] : rawAutoId;

  const compatChatListRef = useRef<FlatList<CompatListRow>>(null);
  const compatInputRef = useRef<TextInput>(null);
  const compatThreadReady = useRef(false);
  const autoSelectHandled = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<PeopleProfileRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const [selectedPerson, setSelectedPerson] = useState<PeopleProfileRow | null>(null);
  const [showPersonSelector, setShowPersonSelector] = useState(false);
  const [profileCardVisible, setProfileCardVisible] = useState(false);
  const [starterChipsVisible, setStarterChipsVisible] = useState(false);
  const [tailRows, setTailRows] = useState<CompatTailRow[]>([]);

  const [compatConversationId, setCompatConversationId] = useState<string | null>(null);
  const [compatInputText, setCompatInputText] = useState("");

  const {
    messages,
    setMessages,
    isStreaming,
    sendMessage: hookCompatSend,
    retryLastMessage,
  } = useStreamingChat({
    streamUrl: `${dreamChatApiBase}/api/people/compatibility/chat`,
    getToken,
    getExtraBody: () => ({
      personProfileId: selectedPerson?.id ?? "",
      ...(compatConversationId ? { conversationId: compatConversationId } : {}),
    }),
    nonStreamingPath: "/api/people/compatibility/message",
    onConversationId: (id) => setCompatConversationId(id),
    onPaywall: () => setPaywallOpen(true),
    emptyErrorText: t("chat.errorMessage"),
    onFailedTurn: (draft) => setCompatInputText(draft),
  });

  const appLanguage = i18n.language.startsWith("fa") ? "fa" : "en";

  const compatVoice = useVoiceMode({
    getToken,
    language: appLanguage,
    onTranscript: (text) => {
      void hookCompatSend(text, {
        inputMode: "voice",
        transcript: text,
        language: appLanguage,
      });
    },
  });

  const compatStreamingPreview = useMemo(() => {
    if (!isStreaming) return "";
    const last = [...messages].reverse().find((m) => m.role === "assistant" && m.isStreaming);
    return last?.content ?? "";
  }, [messages, isStreaming]);

  const compatVoiceErrorDetail =
    compatVoice.errorKey === "permission"
      ? t("voice.errorPermission")
      : compatVoice.errorKey === "transcribe"
        ? t("voice.errorTranscribe")
        : compatVoice.errorKey === "unsupported"
          ? t("voice.errorUnsupported")
          : null;

  useEffect(() => {
    setCompatConversationId(null);
  }, [selectedPerson?.id]);

  useEffect(() => {
    if (compatThreadReady.current) return;
    compatThreadReady.current = true;
    setMessages([
      {
        id: "compat_opening",
        role: "assistant",
        content: t("compatibility.openingMessage"),
        followUpPrompts: [t("compatibility.chooseFromList"), t("compatibility.addSomeone")],
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time thread bootstrap
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetJson<{ profiles: PeopleProfileRow[] }>("/api/people", getToken);
      setProfiles(res.profiles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoSelectPersonId || loading || profiles.length === 0) return;
    if (autoSelectHandled.current === autoSelectPersonId) return;
    const p = profiles.find((x) => x.id === autoSelectPersonId);
    if (!p) return;
    autoSelectHandled.current = autoSelectPersonId;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelectedPerson(p);
    setShowPersonSelector(false);
    setProfileCardVisible(true);
    setStarterChipsVisible(true);
  }, [autoSelectPersonId, loading, profiles]);

  const openChooseList = () => {
    setPaywallOpen(false);
    if (profiles.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `compat_empty_${Date.now()}`,
          role: "assistant",
          content: t("compatibility.noOneYet"),
          followUpPrompts: [t("compatibility.addSomeone")],
        },
      ]);
      return;
    }
    void Haptics.selectionAsync().catch(() => {});
    setShowPersonSelector(true);
  };

  const openAddPerson = () => {
    void Haptics.selectionAsync().catch(() => {});
    router.push("/(main)/people/add?returnTo=compatibility" as Href);
  };

  const selectPersonFromList = (p: PeopleProfileRow) => {
    void Haptics.selectionAsync().catch(() => {});
    setSelectedPerson(p);
    setShowPersonSelector(false);
    setProfileCardVisible(true);
    setStarterChipsVisible(true);
  };

  const ensureCompatibilityReport = async (personId: string): Promise<CompatibilityReportPayload> => {
    try {
      const cached = await apiGetJson<{ report: CompatibilityReportPayload }>(
        `/api/people/compatibility/report/${personId}`,
        getToken,
      );
      return cached.report;
    } catch {
      const created = await apiPostJson<{ report: CompatibilityReportPayload }>(
        "/api/people/compatibility/report",
        getToken,
        { personProfileId: personId },
      );
      return created.report;
    }
  };

  const handleDailyCompatibilityIntent = async () => {
    if (!selectedPerson) {
      setMessages((prev) => [
        ...prev,
        {
          id: `compat_pick_${Date.now()}`,
          role: "assistant",
          content: t("compatibility.openingMessage"),
          followUpPrompts: [t("compatibility.chooseFromList"), t("compatibility.addSomeone")],
        },
      ]);
      return;
    }
    setPaywallOpen(false);
    const loadId = `lr_${Date.now()}`;
    setTailRows((r) => [...r, { id: loadId, tailKind: "loading", text: t("compatibility.calculating") }]);
    try {
      const report = await ensureCompatibilityReport(selectedPerson.id);
      const personName = selectedPerson.name;
      setTailRows((r) => {
        const rest = r.filter((x) => x.id !== loadId);
        const iid = `ins_${report.id}_${Date.now()}`;
        const cid = `tc_${Date.now()}`;
        return [
          ...rest,
          { id: iid, tailKind: "insight", report },
          {
            id: cid,
            tailKind: "tail_chips",
            prompts: [
              t("compatibility.whatCanWeDo"),
              t("compatibility.theirEnergyToday", { name: personName }),
              t("compatibility.venusInteraction"),
            ],
          },
        ];
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTailRows((r) => r.filter((x) => x.id !== loadId));
      if (msg.includes("premium_required")) {
        setPaywallOpen(true);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `compat_rep_err_${Date.now()}`,
          role: "assistant",
          content: t("compatibility.reportFailed"),
          isError: true,
          followUpPrompts: [t("compatibility.seeDaily")],
        },
      ]);
    }
  };

  const handleBubbleFollowUp = (prompt: string) => {
    if (prompt === t("compatibility.chooseFromList")) {
      openChooseList();
      return;
    }
    if (prompt === t("compatibility.addSomeone")) {
      openAddPerson();
      return;
    }
    if (prompt === t("compatibility.seeDaily")) {
      void handleDailyCompatibilityIntent();
      return;
    }
    if (!selectedPerson) {
      setMessages((prev) => [
        ...prev,
        {
          id: `compat_need_person_${Date.now()}`,
          role: "assistant",
          content: t("compatibility.pickSomeoneFirst"),
          followUpPrompts: [t("compatibility.chooseFromList"), t("compatibility.addSomeone")],
        },
      ]);
      return;
    }
    void hookCompatSend(prompt);
  };

  const handleStarterChip = (prompt: string) => {
    if (prompt === t("compatibility.seeDaily")) {
      void handleDailyCompatibilityIntent();
      return;
    }
    if (selectedPerson) void hookCompatSend(prompt);
  };

  const handleTailChip = (prompt: string) => {
    if (!selectedPerson) return;
    void hookCompatSend(prompt);
  };

  const submitInput = async () => {
    const text = compatInputText.trim();
    if (!text || isStreaming) return;
    if (text === t("compatibility.seeDaily")) {
      setCompatInputText("");
      void handleDailyCompatibilityIntent();
      return;
    }
    if (!selectedPerson) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setCompatInputText("");
      setMessages((prev) => [
        ...prev,
        {
          id: `compat_type_need_${Date.now()}`,
          role: "assistant",
          content: t("compatibility.pickSomeoneFirst"),
          followUpPrompts: [t("compatibility.chooseFromList"), t("compatibility.addSomeone")],
        },
      ]);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCompatInputText("");
    await hookCompatSend(text);
  };

  const flatData = useMemo((): CompatListRow[] => {
    const rows: CompatListRow[] = [];
    const m0 = messages[0];
    if (m0) rows.push({ rowKind: "msg", message: m0 });
    if (showPersonSelector) rows.push({ rowKind: "selector" });
    if (selectedPerson && profileCardVisible) {
      rows.push({ rowKind: "profile" });
      if (starterChipsVisible) rows.push({ rowKind: "starter_chips" });
    }
    for (let i = 1; i < messages.length; i++) {
      const m = messages[i];
      if (m) rows.push({ rowKind: "msg", message: m });
    }
    for (const tail of tailRows) rows.push({ rowKind: "tail", tail });
    return rows;
  }, [messages, showPersonSelector, selectedPerson, profileCardVisible, starterChipsVisible, tailRows]);

  const starterPrompts = useMemo(() => {
    if (!selectedPerson) return [];
    return [
      t("compatibility.howSignsInteract"),
      t("compatibility.whatKnowUs"),
      t("compatibility.feelingToday", { name: selectedPerson.name }),
      t("compatibility.seeDaily"),
    ];
  }, [selectedPerson, t]);

  const listKeyExtractor = (item: CompatListRow, index: number) => {
    if (item.rowKind === "msg") return item.message.id;
    if (item.rowKind === "selector") return "selector";
    if (item.rowKind === "profile") return "profile_card";
    if (item.rowKind === "starter_chips") return "starter_chips";
    return `${item.tail.id}_${index}`;
  };

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      <View style={{ flex: 1, position: "relative" }}>
      <View className="mb-2 items-center pt-2">
        <Text
          className="text-lg font-semibold"
          style={{ color: tc.textPrimary, writingDirection: rtl ? "rtl" : "ltr" }}
          numberOfLines={1}
        >
          {t("compatibility.screenTitle")}
        </Text>
        {selectedPerson ? (
          <Text
            className="mt-1 text-xs"
            style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
            numberOfLines={1}
          >
            {t("compatibility.withName", { name: selectedPerson.name })}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 pt-4">
          <Text style={{ color: tc.textPrimary }} className="mb-4 text-lg font-semibold">
            {t("people.listError")}
          </Text>
          <Text style={{ color: tc.textSecondary }}>{error}</Text>
          <Button title={t("common.tryAgain") ?? "Try again"} onPress={() => void load()} className="mt-4" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? CHAT_KAV_HEADER_OFFSET_IOS : 0}
        >
          <FlatList
            ref={compatChatListRef}
            data={flatData}
            keyExtractor={listKeyExtractor}
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 16, flexGrow: 1 }}
            onContentSizeChange={() => compatChatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => compatChatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              if (item.rowKind === "msg") {
                return (
                  <ChatMessageBubble
                    message={item.message}
                    rtl={rtl}
                    theme={theme}
                    onFollowUpTap={handleBubbleFollowUp}
                    onRetry={retryLastMessage}
                  />
                );
              }
              if (item.rowKind === "selector") {
                return (
                  <View className="mb-2 gap-2">
                    <Text
                      className="mb-1 text-sm font-medium"
                      style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
                    >
                      {t("compatibility.chooseFromList")}
                    </Text>
                    {profiles.map((p) => {
                      const initial = p.name.trim().charAt(0).toUpperCase() || "?";
                      const rel = t(`people.relationship.${p.relationshipType}`, {
                        defaultValue: p.relationshipType,
                      });
                      const rowDir = rtl ? "flex-row-reverse" : "flex-row";
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => selectPersonFromList(p)}
                          className={`min-h-[48px] items-center rounded-xl border px-3 py-3 ${rowDir}`}
                          style={{ borderColor: tc.border, backgroundColor: theme.colors.surface }}
                          accessibilityRole="button"
                        >
                          <View
                            className="h-11 w-11 items-center justify-center rounded-full"
                            style={{ backgroundColor: theme.colors.cardAccent2 }}
                          >
                            <Text className="text-lg font-semibold" style={{ color: tc.textPrimary }}>
                              {initial}
                            </Text>
                          </View>
                          <View className="min-w-0 flex-1 px-3">
                            <View className={`flex-row items-center gap-1 ${rtl ? "flex-row-reverse" : "flex-row"}`}>
                              <Text
                                className="text-base font-semibold"
                                style={{
                                  color: tc.textPrimary,
                                  textAlign: rtl ? "right" : "left",
                                  writingDirection: rtl ? "rtl" : "ltr",
                                }}
                                numberOfLines={1}
                              >
                                {p.name}
                              </Text>
                              {p.hasFullData ? <Text style={{ color: tc.textTertiary }}>✦</Text> : null}
                            </View>
                            <Text
                              className="text-sm"
                              style={{
                                color: tc.textSecondary,
                                textAlign: rtl ? "right" : "left",
                                writingDirection: rtl ? "rtl" : "ltr",
                              }}
                              numberOfLines={2}
                            >
                              {rel}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              }
              if (item.rowKind === "profile" && selectedPerson) {
                return <CompatibilityProfileContextCard person={selectedPerson} rtl={rtl} theme={theme} />;
              }
              if (item.rowKind === "starter_chips") {
                return <CompatibilityChipRow prompts={starterPrompts} onPress={handleStarterChip} rtl={rtl} />;
              }
              if (item.rowKind === "tail") {
                const tr = item.tail;
                if (tr.tailKind === "loading") {
                  return (
                    <View className="mb-2 items-start">
                      <View
                        className="rounded-xl border p-4"
                        style={{ borderColor: theme.colors.outline, backgroundColor: theme.colors.surface }}
                      >
                        <Text style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}>{tr.text}</Text>
                      </View>
                    </View>
                  );
                }
                if (tr.tailKind === "insight") {
                  return <CompatibilityInsightCard report={tr.report} rtl={rtl} theme={theme} />;
                }
                return <CompatibilityChipRow prompts={tr.prompts} onPress={handleTailChip} rtl={rtl} />;
              }
              return null;
            }}
          />
          <VoiceInputBar
            phase={compatVoice.phase}
            streamingAssistantText={compatVoice.phase !== "idle" ? compatStreamingPreview : undefined}
            theme={theme}
            rtl={rtl}
            labels={{
              listening: t("voice.listening"),
              transcribing: t("voice.transcribing"),
              error: t("voice.error"),
            }}
            errorDetail={compatVoiceErrorDetail}
          />
          <ChatComposerBar
            ref={compatInputRef}
            value={compatInputText}
            onChangeText={setCompatInputText}
            onSend={() => void submitInput()}
            placeholder={
              selectedPerson ? t("compatibility.chatPlaceholder") : t("compatibility.chooseFirst")
            }
            theme={theme}
            rtl={rtl}
            horizontalPadding={0}
            inputDisabled={isStreaming || !selectedPerson}
            inactiveSendUnlessText={false}
            sending={isStreaming}
            trailingAccessory={
              compatVoice.isSupported ? (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    void compatVoice.toggleListening();
                  }}
                  disabled={isStreaming || compatVoice.phase === "transcribing" || !selectedPerson}
                  accessibilityRole="button"
                  accessibilityLabel={t("voice.micA11y")}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      compatVoice.phase === "listening"
                        ? theme.colors.primaryContainer
                        : compatVoice.phase === "transcribing"
                          ? theme.colors.surfaceVariant
                          : "transparent",
                    marginStart: 4,
                  }}
                >
                  <VoiceWaveIcon
                    active={compatVoice.phase === "listening"}
                    busy={compatVoice.phase === "transcribing"}
                    color={
                      compatVoice.phase === "listening"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                </Pressable>
              ) : undefined
            }
          />
        </KeyboardAvoidingView>
      )}

      {paywallOpen ? (
        <PaywallScreen
          context="compatibility"
          onContinueFree={() => {
            setPaywallOpen(false);
          }}
        />
      ) : null}

      <VoiceListeningOverlay
        visible={compatVoice.phase === "listening"}
        theme={theme}
        rtl={rtl}
        onStop={() => void compatVoice.toggleListening()}
        onCancel={() => compatVoice.cancelListening()}
      />
      </View>
    </FeatureAuroraSafeArea>
  );
}

type JournalEntryRow = {
  id: string;
  content: string;
  moodTag: string | null;
  promptUsed: string | null;
  createdAt: string | Date;
  entryType?: string | null;
  context?: string | null;
  metadata?: unknown | null;
};

function PersonalGrowthFeature() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const hPad = useChatScreenHorizontalPadding();
  const rtl = i18n.language === "fa";

  const [loading, setLoading] = useState(true);
  const [journalPrompt, setJournalPrompt] = useState<string>("");
  const [journalText, setJournalText] = useState<string>("");
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [timeline, setTimeline] = useState<Array<{ id: string; entryType: string; theme?: string | null; summary?: string | null; date: string | Date }>>([]);
  const [mantraEntries, setMantraEntries] = useState<MantraJournalEntry[]>([]);
  const [mantraNextBefore, setMantraNextBefore] = useState<string | null>(null);
  const [mantraListLoading, setMantraListLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  type GrowthTab = "journal" | "mantras";
  const [tab, setTab] = useState<GrowthTab>("journal");

  useEffect(() => {
    void readMantraUx(MANTRA_UX_KEYS.journalLastTab).then((v) => {
      if (v === "mantras" || v === "journal") setTab(v);
    });
  }, []);

  const persistTab = (next: GrowthTab) => {
    setTab(next);
    void writeMantraUx(MANTRA_UX_KEYS.journalLastTab, next);
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, pRes, eRes, tRes] = await Promise.all([
        getMantraJournalPage(getToken, { limit: 40 }),
        apiGetJson<{ prompt: string }>("/api/journal/prompt", getToken),
        apiGetJson<{ entries: JournalEntryRow[] }>("/api/journal/entries", getToken),
        apiGetJson<{ entries: Array<{ id: string; entryType: string; theme?: string | null; summary?: string | null; date: string | Date }> }>(
          "/api/timeline",
          getToken,
        ),
      ]);
      setMantraEntries(mRes.entries ?? []);
      setMantraNextBefore(mRes.nextBefore);
      setJournalPrompt(pRes.prompt);
      setEntries(eRes.entries ?? []);
      setTimeline(tRes.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMantras = async () => {
    if (!mantraNextBefore || mantraListLoading) return;
    setMantraListLoading(true);
    try {
      const res = await getMantraJournalPage(getToken, { limit: 20, before: mantraNextBefore });
      setMantraEntries((prev) => [...prev, ...res.entries]);
      setMantraNextBefore(res.nextBefore);
    } catch {
      /* ignore */
    } finally {
      setMantraListLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveEntry = async () => {
    setPaywallOpen(false);
    try {
      await apiPostJson("/api/journal/entry", getToken, {
        content: journalText.trim(),
        moodTag: undefined,
        promptUsed: journalPrompt,
      });
      setJournalText("");
      const eRes = await apiGetJson<{ entries: JournalEntryRow[] }>("/api/journal/entries", getToken);
      setEntries(eRes.entries ?? []);
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("free_weekly_limit")) setPaywallOpen(true);
      else setError(s);
    }
  };

  const generateWeeklyDigest = async () => {
    try {
      await apiPostJson("/api/timeline/generate-weekly", getToken, {});
      const tRes = await apiGetJson<{ entries: typeof timeline }>("/api/timeline", getToken);
      setTimeline(tRes.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  };

  const streakDays = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const count = entries.filter((e) => new Date(e.createdAt).getTime() >= weekAgo).length;
    return count;
  }, [entries]);

  const mantraDaysThisMonth = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const dayKeys = new Set<string>();
    for (const e of mantraEntries) {
      const d = new Date(e.completedAt);
      if (d.getFullYear() !== y || d.getMonth() !== mo) continue;
      dayKeys.add(`${y}-${mo}-${d.getDate()}`);
    }
    return dayKeys.size;
  }, [mantraEntries]);

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-4">Could not load growth</Text>
<Text style={{ color: tc.textSecondary }} >{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="mb-3 flex-row rounded-xl border border-indigo-800 p-1">
            <Pressable
              onPress={() => persistTab("journal")}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 py-2 ${
                tab === "journal" ? "bg-indigo-600/50" : ""
              }`}
            >
              <Text style={{ color: tc.textPrimary, fontWeight: tab === "journal" ? "700" : "500" }}>
                {t("mantra.tabJournal")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => persistTab("mantras")}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 py-2 ${
                tab === "mantras" ? "bg-indigo-600/50" : ""
              }`}
            >
              <Text style={{ color: tc.textPrimary, fontWeight: tab === "mantras" ? "700" : "500" }}>
                {t("mantra.tabMantras")}
              </Text>
            </Pressable>
          </View>

          <View className="mb-2 rounded-xl border border-indigo-800 p-4">
            <View className="flex-row items-center justify-between mb-2">
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold">Personal Growth</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">
              {`Streak: ${streakDays} entries (7d) · ${t("mantra.daysPracticed", { count: mantraDaysThisMonth })}`}
            </Text>
            </View>
          {tab === "journal" ? (
            <>
<Text style={{ color: tc.textSecondary }} className="text-sm mb-2">Today’s journal prompt</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{journalPrompt}</Text>
            </>
          ) : (
            <Text style={{ color: tc.textSecondary }} className="text-sm leading-5">
              {t("mantra.mantrasTabBlurb")}
            </Text>
          )}
          </View>

          {tab === "journal" ? (
            <>
          <View className="mb-2 rounded-xl border border-slate-700 p-4">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-2">Write your entry</Text>
            <TextInput
              value={journalText}
              onChangeText={setJournalText}
              placeholder="Take a breath and write…"
              placeholderTextColor="#64748b"
              selectionColor="#8b8cff"
              className="min-h-[120px] rounded-xl border border-slate-700 px-3 py-2"
          style={{ color: tc.textPrimary }}
              multiline
            />
            <View className="mt-2 flex-row gap-2">
              <Button title="Save entry" onPress={() => void saveEntry()} className="flex-1" />
              <Button title="Generate weekly digest" variant="secondary" onPress={() => void generateWeeklyDigest()} className="flex-1" />
            </View>
          </View>

<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mb-2">Recent journal</Text>
          <FlatList
            data={entries.slice(0, 6)}
            keyExtractor={(e) => e.id}
            className="mb-4"
            renderItem={({ item }) => {
              const isMantra = item.entryType === "mantra";
              const meta =
                item.metadata && typeof item.metadata === "object"
                  ? (item.metadata as Record<string, unknown>)
                  : null;
              const practiceMode =
                meta && typeof meta.practiceMode === "string" ? meta.practiceMode : null;
              return (
              <View className="mb-2 rounded-xl border border-slate-800 p-4 bg-slate-950">
<Text style={{ color: tc.textPrimary }} className="text-sm font-semibold">{new Date(item.createdAt).toLocaleDateString()}</Text>
                {isMantra ? (
                  <>
                    <Text style={{ color: tc.isDark ? "#c4b5fd" : "#6d28d9" }} className="mt-1 text-xs font-semibold uppercase">
                      {t("mantra.journalEntryLabel")}
                    </Text>
                    {practiceMode ? (
                      <Text style={{ color: tc.textSecondary }} className="mt-1 text-xs">
                        {practiceMode}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {item.context && isMantra ? (
                  <Text style={{ color: tc.textSecondary }} className="mt-2 text-sm leading-5">
                    {item.context}
                  </Text>
                ) : null}
<Text style={{ color: tc.textPrimary }} className="mt-2 leading-6">{item.content}</Text>
              </View>
              );
            }}
          />

<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mb-2">Weekly digest</Text>
          <FlatList
            data={timeline.slice(0, 6)}
            keyExtractor={(t) => t.id}
            className="flex-1"
            renderItem={({ item }) => (
              <View className="mb-2 rounded-xl border border-slate-800 p-4 bg-slate-950">
<Text style={{ color: tc.textPrimary }} className="text-sm font-semibold">{item.entryType}</Text>
{item.theme ? <Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="mt-1">{item.theme}</Text> : null}
{item.summary ? <Text style={{ color: tc.textPrimary }} className="mt-2 leading-6">{item.summary}</Text> : null}
              </View>
            )}
          />
            </>
          ) : (
            <FlatList
              data={mantraEntries}
              keyExtractor={(e) => e.practiceId}
              onEndReachedThreshold={0.4}
              onEndReached={() => void loadMoreMantras()}
              ListEmptyComponent={
                <Text style={{ color: tc.textSecondary, textAlign: rtl ? "right" : "left" }} className="py-6">
                  {t("mantra.mantrasListEmpty")}
                </Text>
              }
              renderItem={({ item }) => (
                <View className="mb-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <Text style={{ color: tc.textPrimary }} className="text-sm font-semibold">
                    {new Date(item.completedAt).toLocaleString()}
                  </Text>
                  <Text style={{ color: tc.isDark ? "#c4b5fd" : "#6d28d9" }} className="mt-1 text-xs font-semibold uppercase">
                    {item.practiceMode} · {item.durationSec}s
                  </Text>
                  <Text style={{ color: tc.textPrimary, marginTop: 8 }} className="leading-6">
                    {item.mantraText}
                  </Text>
                  {item.journalNote ? (
                    <Text style={{ color: tc.textSecondary, marginTop: 8 }} className="text-sm leading-5">
                      {item.journalNote}
                    </Text>
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </FeatureAuroraSafeArea>
  );
}

type AstrologicalEventRow = {
  title: string;
  eventType: string;
  significance: number;
  category: string;
  whyItMatters: string;
  suggestedAction: string;
  eventDate?: string;
  windowStart?: string;
  windowEnd?: string;
};

function AstrologicalEventsFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const hPad = useChatScreenHorizontalPadding();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AstrologicalEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGetJson<{ events: AstrologicalEventRow[] }>("/api/events/upcoming", getToken);
        setEvents(res.events ?? []);
      } catch (e) {
        const s = e instanceof Error ? e.message : String(e);
        if (s.includes("premium_required")) setPaywallOpen(true);
        else setError(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-4">Could not load events</Text>
<Text style={{ color: tc.textSecondary }} >{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold mb-4">Astrological Events</Text>
          <FlatList
            data={events}
            keyExtractor={(e, idx) => `${idx}_${e.title}`}
            renderItem={({ item }) => (
              <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
                <View className="flex-row items-center justify-between mb-2">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold">{item.title}</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">{item.significance}/100</Text>
                </View>
<Text style={{ color: tc.textSecondary }} >{item.category}</Text>
                {item.eventDate ? (
<Text style={{ color: tc.textSecondary }} className="mt-1">{new Date(item.eventDate).toLocaleDateString()}</Text>
                ) : null}
<Text style={{ color: tc.textPrimary }} className="mt-3 leading-6">{item.whyItMatters}</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="mt-2 leading-6">{`Action: ${item.suggestedAction}`}</Text>
              </View>
            )}
ListEmptyComponent={<Text style={{ color: tc.textSecondary }} >No events available.</Text>}
          />
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </FeatureAuroraSafeArea>
  );
}

type ChallengeClusterRow = {
  id: string;
  confidence: number;
  evidence: string[];
};

function LifeChallengesFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const hPad = useChatScreenHorizontalPadding();

  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<ChallengeClusterRow[]>([]);
  const [interpretation, setInterpretation] = useState<string>("");
  const [hiddenStrengths, setHiddenStrengths] = useState<string[]>([]);
  const [practicePrompts, setPracticePrompts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGetJson<{
          clusters: ChallengeClusterRow[];
          interpretation: string;
          hiddenStrengths: string[];
          practicePrompts: string[];
        }>("/api/challenges/report", getToken);
        setClusters(res.clusters ?? []);
        setInterpretation(res.interpretation ?? "");
        setHiddenStrengths(res.hiddenStrengths ?? []);
        setPracticePrompts(res.practicePrompts ?? []);
      } catch (e) {
        const s = e instanceof Error ? e.message : String(e);
        if (s.includes("premium_required")) setPaywallOpen(true);
        else setError(s);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-4">Could not load challenges</Text>
<Text style={{ color: tc.textSecondary }} >{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="mb-2 text-2xl font-bold">Life Challenges</Text>
          <View className="mb-2 rounded-xl border border-slate-700 p-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Interpretation</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{interpretation}</Text>
          </View>

<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mb-2">Clusters</Text>
          <FlatList
            data={clusters}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
                <View className="flex-row items-center justify-between">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold">{item.id.replace(/_/g, " ")}</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">{Math.round(item.confidence * 100)}%</Text>
                </View>
<Text style={{ color: tc.textSecondary }} className="mt-2">Evidence</Text>
                <Text className="mt-2 text-xs leading-4" style={{ color: tc.textTertiary }}>
                  {item.evidence.join(" · ")}
                </Text>
              </View>
            )}
ListEmptyComponent={<Text style={{ color: tc.textSecondary }} >No clusters found.</Text>}
          />

          {hiddenStrengths.length ? (
            <View className="mt-2 rounded-xl border border-slate-700 p-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Hidden strengths</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{hiddenStrengths.join("\n")}</Text>
            </View>
          ) : null}

          {practicePrompts.length ? (
            <View className="mt-2 rounded-xl border border-slate-700 p-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Practice prompts</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{practicePrompts.join("\n")}</Text>
            </View>
          ) : null}
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </FeatureAuroraSafeArea>
  );
}

type ConflictAdvicePayload = {
  summary: string;
  feelings: string[];
  needs: string[];
  scripts: string[];
  boundaries: string[];
  repairSteps: string[];
  reflectionQuestion: string;
};

type ConflictAdviceUnsafe = {
  error: "unsafe";
  flagType: string;
  response: string;
};

type ConflictAdviceResponse = ConflictAdvicePayload | ConflictAdviceUnsafe;

function ConflictAdviceFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const hPad = useChatScreenHorizontalPadding();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [data, setData] = useState<ConflictAdviceResponse | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setPaywallOpen(false);
    setData(null);
    try {
      const res = await apiPostJson<ConflictAdviceResponse>("/api/conflict/advice", getToken, { message: text });
      if ("error" in res && res.error === "unsafe") {
        setData(res);
        return;
      }
      setData(res);
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(s);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
<Text style={{ color: tc.textPrimary }} className="mb-2 text-2xl font-bold">Conflict Advice</Text>

      <View className="mb-2 rounded-xl border border-slate-700 p-4">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Describe the conflict (what happened, what you want)…"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          className="min-h-[120px] rounded-xl border border-slate-700 px-3 py-2"
          style={{ color: tc.textPrimary }}
          multiline
        />
        <Button title={loading ? "Thinking…" : "Get advice"} onPress={() => void submit()} className="mt-2" />
{error ? <Text style={{ color: tc.textSecondary }} className="mt-3">{error}</Text> : null}
      </View>

      {data && "error" in data && data.error === "unsafe" ? (
        <View className="rounded-xl border border-indigo-800 p-4">
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm uppercase tracking-wide mb-2">Safety note</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{data.response}</Text>
        </View>
      ) : data ? (
        <FlatList
          data={[
            { k: "Summary", v: (data as ConflictAdvicePayload).summary },
            { k: "Feelings", v: (data as ConflictAdvicePayload).feelings.join(" · ") },
            { k: "Needs", v: (data as ConflictAdvicePayload).needs.join(" · ") },
            { k: "Scripts", v: (data as ConflictAdvicePayload).scripts.join("\n\n") },
            { k: "Boundaries", v: (data as ConflictAdvicePayload).boundaries.join("\n") },
            { k: "Repair steps", v: (data as ConflictAdvicePayload).repairSteps.join("\n") },
            { k: "Reflection", v: (data as ConflictAdvicePayload).reflectionQuestion },
          ]}
          keyExtractor={(i) => i.k}
          renderItem={({ item }) => (
            <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm uppercase tracking-wide">{item.k}</Text>
<Text style={{ color: tc.textPrimary }} className="mt-2 leading-6">{item.v}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <View className="flex-1" />
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </FeatureAuroraSafeArea>
  );
}

type CoffeeReadingPayload = {
  visionObservations: string[];
  symbolicMappings: Array<{ symbol: string; meaning: string }>;
  interpretation: string;
  followUpQuestions: string[];
  imageQualityFlag: boolean;
  sessionId?: string;
};

const DREAM_MAX_CHARS = 2000;

function DreamInterpreterFeature() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const { width: dreamWindowWidth } = useWindowDimensions();
  const dreamInputDesktop = dreamWindowWidth >= 768;
  const rtl = i18n.language.startsWith("fa");
  const hPad = useChatScreenHorizontalPadding();
  const [phase, setPhase] = useState<"input" | "loading" | "result" | "error" | "chatting">("input");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [dreamText, setDreamText] = useState("");
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const followUpListRef = useRef<FlatList<StreamingChatMessage>>(null);

  const {
    messages: dreamFollowUpMessages,
    sendMessage: sendDreamFollowUp,
    isStreaming: isDreamFollowUpStreaming,
    clearMessages: clearDreamFollowUpMessages,
    retryLastMessage: retryDreamFollowUp,
  } = useStreamingChat({
    streamUrl: `${dreamChatApiBase}/api/chat/stream`,
    getToken,
    getExtraBody: () => ({
      ...(sessionId != null ? { sessionId } : {}),
      featureKey: "dream_interpreter",
    }),
    onConversationId: setSessionId,
    onPaywall: () => setPaywallOpen(true),
    emptyErrorText: t("dreamInterpreter.genericError"),
    onFailedTurn: (draft) => setFollowUpInput(draft),
  });

  const dreamAppLanguage = i18n.language.startsWith("fa") ? "fa" : "en";

  const dreamVoice = useVoiceMode({
    getToken,
    language: dreamAppLanguage,
    onTranscript: (text) => {
      const p = phaseRef.current;
      if (p === "input") {
        setDreamText((prev) => {
          const next = prev ? `${prev} ${text}` : text;
          return next.length > DREAM_MAX_CHARS ? next.slice(0, DREAM_MAX_CHARS) : next;
        });
      } else if (p === "chatting") {
        void sendDreamFollowUp(text, {
          inputMode: "voice",
          transcript: text,
          language: dreamAppLanguage,
        });
      }
    },
  });

  const dreamStreamingPreview = useMemo(() => {
    if (!isDreamFollowUpStreaming) return "";
    const last = [...dreamFollowUpMessages]
      .reverse()
      .find((m) => m.role === "assistant" && m.isStreaming);
    return last?.content ?? "";
  }, [dreamFollowUpMessages, isDreamFollowUpStreaming]);

  const dreamVoiceErrorDetail =
    dreamVoice.errorKey === "permission"
      ? t("voice.errorPermission")
      : dreamVoice.errorKey === "transcribe"
        ? t("voice.errorTranscribe")
        : dreamVoice.errorKey === "unsupported"
          ? t("voice.errorUnsupported")
          : null;

  const trimmed = dreamText.trim();
  const canSubmit = trimmed.length >= 10 && dreamText.length <= DREAM_MAX_CHARS;

  const resetToInput = () => {
    setPhase("input");
    setDreamText("");
    setInterpretation(null);
    setErrorMessage(null);
    setSessionId(null);
    clearDreamFollowUpMessages();
    setFollowUpInput("");
  };

  const interpret = async () => {
    if (!canSubmit) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase("loading");
    setErrorMessage(null);
    setInterpretation(null);
    try {
      type DreamApi = { content?: string; sessionId?: string; dreamEntryId?: string; error?: string; response?: string };
      const data = await apiPostJson<DreamApi>("/api/dream/interpret", getToken, {
        dreamDescription: trimmed,
      });
      if (data.error === "unsafe") {
        setErrorMessage(data.response ?? t("dreamInterpreter.unsafeResponse"));
        setPhase("error");
        return;
      }
      if (typeof data.content === "string" && data.content.length > 0) {
        setInterpretation(data.content);
        setSessionId(data.sessionId ?? null);
        setPhase("result");
        return;
      }
      setErrorMessage(t("dreamInterpreter.genericError"));
      setPhase("error");
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) {
        setPaywallOpen(true);
        setPhase("input");
      } else if (s.includes("birth_profile_required")) {
        setErrorMessage(t("dreamInterpreter.profileRequired"));
        setPhase("error");
      } else {
        setErrorMessage(t("dreamInterpreter.genericError"));
        setPhase("error");
      }
    }
  };

  const onFollowUp = () => {
    if (!interpretation) return;
    void Haptics.selectionAsync().catch(() => {});
    setPhase("chatting");
  };

  const handleSendFollowUp = async () => {
    const text = followUpInput.trim();
    if (!text || isDreamFollowUpStreaming || !sessionId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFollowUpInput("");
    await sendDreamFollowUp(text);
  };

  /** Chat messages shown in the chatting phase: interpretation first, then follow-ups. */
  const chattingData: StreamingChatMessage[] = interpretation
    ? [
        { id: "interpretation", role: "assistant", content: interpretation },
        ...dreamFollowUpMessages,
      ]
    : dreamFollowUpMessages;

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      <View style={{ flex: 1, position: "relative" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? CHAT_KAV_HEADER_OFFSET_IOS : 0}
      >
        {phase === "input" ? (
          <View
            className="flex-1"
            style={{
              ...(dreamInputDesktop ? { maxWidth: 700, alignSelf: "center", width: "100%" } : {}),
            }}
          >
            <Text
              className="text-2xl font-bold mb-2"
              style={{
                color: tc.textPrimary,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: rtl ? "right" : "left",
              }}
            >
              {t("features.dreamInterpreter")}
            </Text>
            <Text
              className="mb-4 leading-6"
              style={{
                color: tc.textSecondary,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: rtl ? "right" : "left",
              }}
            >
              {t("dreamInterpreter.subtitle")}
            </Text>
            <TextInput
              value={dreamText}
              onChangeText={(x) => setDreamText(x.length > DREAM_MAX_CHARS ? x.slice(0, DREAM_MAX_CHARS) : x)}
              placeholder={t("dreamInterpreter.placeholder")}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              textAlignVertical="top"
              className="rounded-xl border border-slate-600 px-3 py-2 text-base"
              style={{
                color: tc.textPrimary,
                flex: 1,
                minHeight: 168,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: rtl ? "right" : "left",
              }}
            />
            <Text
              className="text-sm mt-2 mb-4"
              style={{
                color: tc.textTertiary,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: rtl ? "right" : "left",
              }}
            >
              {t("dreamInterpreter.charCount", { current: dreamText.length, max: DREAM_MAX_CHARS })}
            </Text>
            <View className="w-full flex-row flex-wrap items-center justify-center gap-3">
              <Button
                title={t("dreamInterpreter.interpretCta")}
                onPress={() => void interpret()}
                disabled={!canSubmit}
              />
              {dreamVoice.isSupported ? (
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    void dreamVoice.toggleListening();
                  }}
                  disabled={dreamVoice.phase === "transcribing"}
                  accessibilityRole="button"
                  accessibilityLabel={t("voice.micA11y")}
                  hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      dreamVoice.phase === "listening"
                        ? theme.colors.primaryContainer
                        : dreamVoice.phase === "transcribing"
                          ? theme.colors.surfaceVariant
                          : "transparent",
                  }}
                >
                  <VoiceWaveIcon
                    active={dreamVoice.phase === "listening"}
                    busy={dreamVoice.phase === "transcribing"}
                    color={
                      dreamVoice.phase === "listening"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {phase === "loading" ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text
              className="mt-6 text-center"
              style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {t("dreamInterpreter.loading")}
            </Text>
          </View>
        ) : null}

        {phase === "result" && interpretation ? (
          <FlatList
            data={interpretation.split(/\n\n+/).filter(Boolean)}
            keyExtractor={(_, i) => `p_${i}`}
            ListHeaderComponent={
              <Text
                className="text-2xl font-bold mb-4"
                style={{
                  color: tc.textPrimary,
                  writingDirection: rtl ? "rtl" : "ltr",
                  textAlign: rtl ? "right" : "left",
                }}
              >
                {t("features.dreamInterpreter")}
              </Text>
            }
            renderItem={({ item }) => (
              <Text
                className="mb-4 leading-6"
                style={{
                  color: tc.textPrimary,
                  writingDirection: rtl ? "rtl" : "ltr",
                  textAlign: rtl ? "right" : "left",
                }}
              >
                {item}
              </Text>
            )}
            contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
            ListFooterComponent={
              <View className="mt-2 gap-3">
                <Button title={t("dreamInterpreter.followUp")} onPress={onFollowUp} />
                <Button title={t("dreamInterpreter.anotherDream")} onPress={resetToInput} />
              </View>
            }
          />
        ) : null}

        {phase === "error" ? (
          <View className="flex-1">
            <Text
              className="mb-6 text-lg leading-6"
              style={{
                color: tc.textPrimary,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: rtl ? "right" : "left",
              }}
            >
              {errorMessage ?? t("dreamInterpreter.genericError")}
            </Text>
            <Button title={t("common.tryAgain")} onPress={resetToInput} />
          </View>
        ) : null}

        {phase === "chatting" ? (
          <View className="flex-1">
            {/* Top strip: dream summary + back link */}
            <View className="mb-2 flex-row items-center justify-between">
              <Pressable
                onPress={() => setPhase("result")}
                hitSlop={8}
                className="flex-row items-center gap-2"
              >
                <Ionicons
                  name={rtl ? "chevron-forward" : "chevron-back"}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text className="text-sm" style={{ color: theme.colors.primary }}>
                  {t("common.back")}
                </Text>
              </Pressable>
              <Text
                className="ml-3 flex-1 text-right text-xs"
                numberOfLines={1}
                style={{ color: theme.colors.onSurfaceVariant, textAlign: rtl ? "left" : "right" }}
              >
                {t("dreamInterpreter.dreamSummaryLabel")}
              </Text>
            </View>

            {/* Dream summary pill */}
            <View
              className="mb-2 rounded-xl px-3 py-2"
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            >
              <Text
                className="text-xs leading-5"
                numberOfLines={2}
                style={{
                  color: theme.colors.onSurfaceVariant,
                  writingDirection: rtl ? "rtl" : "ltr",
                  textAlign: rtl ? "right" : "left",
                }}
              >
                {dreamText.length > 80 ? `${dreamText.slice(0, 80)}…` : dreamText}
              </Text>
            </View>

            {/* Chat messages */}
            <FlatList
              ref={followUpListRef}
              data={chattingData}
              keyExtractor={(item) => item.id}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 12 }}
              onContentSizeChange={() => followUpListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <ChatMessageBubble
                  message={item}
                  rtl={rtl}
                  theme={theme}
                  onFollowUpTap={(prompt) => setFollowUpInput(prompt)}
                  onRetry={retryDreamFollowUp}
                />
              )}
            />

            <VoiceInputBar
              phase={dreamVoice.phase}
              streamingAssistantText={dreamVoice.phase !== "idle" ? dreamStreamingPreview : undefined}
              theme={theme}
              rtl={rtl}
              labels={{
                listening: t("voice.listening"),
                transcribing: t("voice.transcribing"),
                error: t("voice.error"),
              }}
              errorDetail={dreamVoiceErrorDetail}
            />
            <ChatComposerBar
              value={followUpInput}
              onChangeText={setFollowUpInput}
              onSend={() => void handleSendFollowUp()}
              placeholder={t("dreamInterpreter.followUpPlaceholder")}
              theme={theme}
              rtl={rtl}
              horizontalPadding={0}
              inputDisabled={isDreamFollowUpStreaming || !sessionId}
              sending={isDreamFollowUpStreaming}
              trailingAccessory={
                dreamVoice.isSupported ? (
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      void dreamVoice.toggleListening();
                    }}
                    disabled={
                      isDreamFollowUpStreaming || dreamVoice.phase === "transcribing" || !sessionId
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t("voice.micA11y")}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        dreamVoice.phase === "listening"
                          ? theme.colors.primaryContainer
                          : dreamVoice.phase === "transcribing"
                            ? theme.colors.surfaceVariant
                            : "transparent",
                      marginStart: 4,
                    }}
                  >
                    <VoiceWaveIcon
                      active={dreamVoice.phase === "listening"}
                      busy={dreamVoice.phase === "transcribing"}
                      color={
                        dreamVoice.phase === "listening"
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </Pressable>
                ) : undefined
              }
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}

      <VoiceListeningOverlay
        visible={
          dreamVoice.phase === "listening" && (phase === "input" || phase === "chatting")
        }
        theme={theme}
        rtl={rtl}
        onStop={() => void dreamVoice.toggleListening()}
        onCancel={() => dreamVoice.cancelListening()}
      />
      </View>
    </FeatureAuroraSafeArea>
  );
}

/**
 * Reads base64 from an ImagePicker asset, with web FileReader fallback when base64 is missing.
 */
async function imageAssetToBase64(asset: {
  uri?: string | null;
  base64?: string | null;
  mimeType?: string | null;
}): Promise<{ base64: string | null; mime: string }> {
  const mime = asset.mimeType ?? "image/jpeg";
  let imageBase64 = asset.base64 ?? null;
  if (!imageBase64 && asset.uri && typeof FileReader !== "undefined") {
    const blob = await fetch(asset.uri).then((r) => r.blob());
    imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const out = reader.result as string;
        resolve(out.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return { base64: imageBase64, mime };
}

function CoffeeReadingFeature() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const rtl = i18n.language.startsWith("fa");
  const hPad = useChatScreenHorizontalPadding();
  const apiLanguage = rtl ? "fa" : "en";
  const coffeeAccent = getFeatureConfig("coffee_reading").color;
  const greenCheck = "#34d399";

  const [phase, setPhase] = useState<"upload" | "result" | "chatting">("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [data, setData] = useState<CoffeeReadingPayload | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const coffeeChatListRef = useRef<FlatList<StreamingChatMessage>>(null);

  const {
    messages: coffeeFollowUpMessages,
    sendMessage: sendCoffeeFollowUp,
    isStreaming: isCoffeeFollowUpStreaming,
    clearMessages: clearCoffeeFollowUpMessages,
    retryLastMessage: retryCoffeeFollowUp,
  } = useStreamingChat({
    streamUrl: `${dreamChatApiBase}/api/chat/stream`,
    getToken,
    getExtraBody: () => ({
      ...(sessionId != null ? { sessionId } : {}),
      featureKey: "coffee_reading",
    }),
    onConversationId: setSessionId,
    onPaywall: () => setPaywallOpen(true),
    emptyErrorText: t("chat.errorMessage"),
    onFailedTurn: (draft) => setFollowUpInput(draft),
  });

  const coffeeLang: "fa" | "en" = apiLanguage === "en" ? "en" : "fa";

  const coffeeVoice = useVoiceMode({
    getToken,
    language: coffeeLang,
    onTranscript: (text) => {
      void sendCoffeeFollowUp(text, {
        inputMode: "voice",
        transcript: text,
        language: coffeeLang,
      });
    },
  });

  const coffeeStreamingPreview = useMemo(() => {
    if (!isCoffeeFollowUpStreaming) return "";
    const last = [...coffeeFollowUpMessages]
      .reverse()
      .find((m) => m.role === "assistant" && m.isStreaming);
    return last?.content ?? "";
  }, [coffeeFollowUpMessages, isCoffeeFollowUpStreaming]);

  const coffeeVoiceErrorDetail =
    coffeeVoice.errorKey === "permission"
      ? t("voice.errorPermission")
      : coffeeVoice.errorKey === "transcribe"
        ? t("voice.errorTranscribe")
        : coffeeVoice.errorKey === "unsupported"
          ? t("voice.errorUnsupported")
          : null;

  const [cupUri, setCupUri] = useState<string | null>(null);
  const [cupBase64, setCupBase64] = useState<string | null>(null);
  const [cupMime, setCupMime] = useState("image/jpeg");
  const [saucerUri, setSaucerUri] = useState<string | null>(null);
  const [saucerBase64, setSaucerBase64] = useState<string | null>(null);
  const [saucerMime, setSaucerMime] = useState("image/jpeg");

  const mapCoffeeApiError = (raw: string): string => {
    try {
      const j = JSON.parse(raw) as { error?: string; code?: string };
      if (j.code === "image_too_large") return t("coffeeReading.imageTooLarge");
      if (j.code === "invalid_image_type") return t("coffeeReading.invalidImageType");
    } catch {
      /* plain text */
    }
    if (raw.includes("image_too_large")) return t("coffeeReading.imageTooLarge");
    if (raw.includes("Invalid image type")) return t("coffeeReading.invalidImageType");
    return t("coffeeReading.genericError");
  };

  const pickImage = async (slot: "cup" | "saucer") => {
    void Haptics.selectionAsync().catch(() => {});
    setError(null);
    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;

      const { base64: imageBase64, mime } = await imageAssetToBase64(asset);
      if (!imageBase64) {
        setError(t("coffeeReading.readError"));
        return;
      }

      if (slot === "cup") {
        setCupUri(asset.uri ?? null);
        setCupBase64(imageBase64);
        setCupMime(mime);
      } else {
        setSaucerUri(asset.uri ?? null);
        setSaucerBase64(imageBase64);
        setSaucerMime(mime);
      }
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      setError(mapCoffeeApiError(s));
    }
  };

  const canProceed = Boolean(cupBase64 && saucerBase64);

  const proceedToReading = async () => {
    if (!canProceed || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLoading(true);
    setError(null);
    setPaywallOpen(false);
    setData(null);
    setPhase("upload");
    setSessionId(null);
    clearCoffeeFollowUpMessages();
    setFollowUpInput("");
    try {
      const reading = await apiPostJson<CoffeeReadingPayload>("/api/coffee/reading", getToken, {
        imageBase64: cupBase64!,
        mimeType: cupMime,
        saucerImageBase64: saucerBase64!,
        saucerMimeType: saucerMime,
        language: apiLanguage,
      });
      setData(reading);
      if (reading.sessionId) setSessionId(reading.sessionId);
      setPhase("result");
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(mapCoffeeApiError(s));
    } finally {
      setLoading(false);
    }
  };

  const buildCoffeeReadingContextContent = (d: CoffeeReadingPayload) =>
    [
      `${t("coffeeReading.sectionInterpretation")}: ${d.interpretation}`,
      `${t("coffeeReading.sectionObservations")}: ${(d.visionObservations ?? []).join(" · ")}`,
      `${t("coffeeReading.sectionSymbols")}:\n${(d.symbolicMappings ?? [])
        .map((m) => `${m.symbol}: ${m.meaning}`)
        .join("\n")}`,
    ].join("\n\n");

  const enterChatWithContext = (initialMessage?: string) => {
    if (!data || !sessionId) return;
    void Haptics.selectionAsync().catch(() => {});
    setPhase("chatting");
    const trimmed = initialMessage?.trim();
    if (trimmed) void sendCoffeeFollowUp(trimmed);
  };

  const handleSendCoffeeFollowUp = async () => {
    const text = followUpInput.trim();
    if (!text || isCoffeeFollowUpStreaming || !sessionId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFollowUpInput("");
    await sendCoffeeFollowUp(text);
  };

  const coffeeChattingData: StreamingChatMessage[] = data
    ? [
        { id: "coffee_reading_context", role: "assistant", content: buildCoffeeReadingContextContent(data) },
        ...coffeeFollowUpMessages,
      ]
    : coffeeFollowUpMessages;

  const chatAvailable = Boolean(sessionId);

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      <View style={{ flex: 1, position: "relative" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? CHAT_KAV_HEADER_OFFSET_IOS : 0}
      >
        {loading && !data ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text
              className="mt-6 text-center"
              style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {t("coffeeReading.reading")}
            </Text>
          </View>
        ) : null}

        {data && phase === "result" ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
              <Text
                className="text-indigo-200 text-sm uppercase tracking-wide"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {t("coffeeReading.sectionInterpretation")}
              </Text>
              <Text
                className="text-slate-200 mt-2 leading-6"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {data.interpretation}
              </Text>
            </View>
            <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
              <Text
                className="text-indigo-200 text-sm uppercase tracking-wide"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {t("coffeeReading.sectionObservations")}
              </Text>
              <Text
                className="text-slate-200 mt-2 leading-6"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {(data.visionObservations ?? []).join(" · ")}
              </Text>
            </View>
            <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
              <Text
                className="text-indigo-200 text-sm uppercase tracking-wide"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {t("coffeeReading.sectionSymbols")}
              </Text>
              <Text
                className="text-slate-200 mt-2 leading-6"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {(data.symbolicMappings ?? []).map((m) => `${m.symbol}: ${m.meaning}`).join("\n")}
              </Text>
            </View>

            <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
              <Text
                className="mb-2 text-sm uppercase tracking-wide text-indigo-200"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {t("coffeeReading.sectionFollowUps")}
              </Text>
              {(data.followUpQuestions ?? []).map((question, index) => (
                <Pressable
                  key={`${index}-${question.slice(0, 48)}`}
                  disabled={!chatAvailable}
                  onPress={() => enterChatWithContext(question)}
                  className="mb-2 min-h-[48px] rounded-[20px] border px-3 py-2"
                  style={{
                    flexDirection: rtl ? "row-reverse" : "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    borderColor: tc.isDark ? "#4338ca" : "#6366f1",
                    opacity: chatAvailable ? 1 : 0.45,
                  }}
                >
                  <Text style={{ color: "#818cf8", fontSize: 16 }}>✦</Text>
                  <Text
                    className="flex-1 text-sm leading-5"
                    style={{
                      color: tc.textPrimary,
                      writingDirection: rtl ? "rtl" : "ltr",
                      textAlign: rtl ? "right" : "left",
                    }}
                  >
                    {question}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View
              style={{ flexDirection: rtl ? "row-reverse" : "row", gap: 10, marginTop: 8, marginBottom: 8 }}
            >
              <Pressable
                onPress={() => {
                  setPhase("upload");
                  setData(null);
                  setSessionId(null);
                  clearCoffeeFollowUpMessages();
                  setFollowUpInput("");
                  setError(null);
                  setCupUri(null);
                  setCupBase64(null);
                  setCupMime("image/jpeg");
                  setSaucerUri(null);
                  setSaucerBase64(null);
                  setSaucerMime("image/jpeg");
                }}
                className="min-h-[48px] flex-1 items-center justify-center rounded-xl px-4 py-3"
                style={{
                  backgroundColor: theme.colors.surfaceVariant,
                  borderWidth: 1,
                  borderColor: theme.colors.outline ?? "rgba(255,255,255,0.15)",
                }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    writingDirection: rtl ? "rtl" : "ltr",
                  }}
                >
                  {t("coffeeReading.newReading")}
                </Text>
              </Pressable>

              <Pressable
                disabled={!chatAvailable}
                onPress={() => enterChatWithContext()}
                className="min-h-[48px] flex-1 items-center justify-center rounded-xl px-4 py-3"
                style={{
                  backgroundColor: chatAvailable ? theme.colors.primary : theme.colors.surfaceVariant,
                  opacity: chatAvailable ? 1 : 0.55,
                }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{
                    color: chatAvailable ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                    writingDirection: rtl ? "rtl" : "ltr",
                  }}
                >
                  {t("coffeeReading.chatWithReading")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}

        {data && phase === "chatting" ? (
          <View className="flex-1">
            <View className="mb-2 flex-row items-center justify-between">
              <Pressable
                onPress={() => setPhase("result")}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-[20px]"
              >
                <Ionicons
                  name={rtl ? "arrow-forward" : "arrow-back"}
                  size={24}
                  color={theme.colors.primary}
                />
              </Pressable>
              <Text
                className="ml-3 flex-1 text-right text-xs"
                numberOfLines={1}
                style={{ color: theme.colors.onSurfaceVariant, textAlign: rtl ? "left" : "right" }}
              >
                {t("coffeeReading.screenTitle")}
              </Text>
            </View>

            <View
              className="mb-2 rounded-xl px-3 py-2"
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            >
              <Text
                className="text-xs leading-5"
                numberOfLines={2}
                style={{
                  color: theme.colors.onSurfaceVariant,
                  writingDirection: rtl ? "rtl" : "ltr",
                  textAlign: rtl ? "right" : "left",
                }}
              >
                {data.interpretation.length > 80 ? `${data.interpretation.slice(0, 80)}…` : data.interpretation}
              </Text>
            </View>

            <FlatList
              ref={coffeeChatListRef}
              data={coffeeChattingData}
              keyExtractor={(item) => item.id}
              className="flex-1"
              contentContainerStyle={{ paddingBottom: 12 }}
              onContentSizeChange={() => coffeeChatListRef.current?.scrollToEnd({ animated: true })}
              renderItem={({ item }) => (
                <ChatMessageBubble
                  message={item}
                  rtl={rtl}
                  theme={theme}
                  onFollowUpTap={(prompt) => setFollowUpInput(prompt)}
                  onRetry={retryCoffeeFollowUp}
                />
              )}
            />

            <VoiceInputBar
              phase={coffeeVoice.phase}
              streamingAssistantText={coffeeVoice.phase !== "idle" ? coffeeStreamingPreview : undefined}
              theme={theme}
              rtl={rtl}
              labels={{
                listening: t("voice.listening"),
                transcribing: t("voice.transcribing"),
                error: t("voice.error"),
              }}
              errorDetail={coffeeVoiceErrorDetail}
            />
            <ChatComposerBar
              value={followUpInput}
              onChangeText={setFollowUpInput}
              onSend={() => void handleSendCoffeeFollowUp()}
              placeholder={t("coffeeReading.chatPlaceholder")}
              theme={theme}
              rtl={rtl}
              horizontalPadding={0}
              inputDisabled={isCoffeeFollowUpStreaming || !sessionId}
              sending={isCoffeeFollowUpStreaming}
              trailingAccessory={
                coffeeVoice.isSupported ? (
                  <Pressable
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      void coffeeVoice.toggleListening();
                    }}
                    disabled={
                      isCoffeeFollowUpStreaming || coffeeVoice.phase === "transcribing" || !sessionId
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t("voice.micA11y")}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        coffeeVoice.phase === "listening"
                          ? theme.colors.primaryContainer
                          : coffeeVoice.phase === "transcribing"
                            ? theme.colors.surfaceVariant
                            : "transparent",
                      marginStart: 4,
                    }}
                  >
                    <VoiceWaveIcon
                      active={coffeeVoice.phase === "listening"}
                      busy={coffeeVoice.phase === "transcribing"}
                      color={
                        coffeeVoice.phase === "listening"
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  </Pressable>
                ) : undefined
              }
            />
          </View>
        ) : null}

        {!data && !(loading && !data) ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            className="text-2xl font-bold mb-2 text-center"
            style={{ color: tc.textPrimary, writingDirection: rtl ? "rtl" : "ltr" }}
          >
            {t("coffeeReading.screenTitle")}
          </Text>
          <Text
            className="text-sm leading-6 mb-6 max-w-[360px] self-center text-center"
            style={{ color: tc.textTertiary, writingDirection: rtl ? "rtl" : "ltr" }}
          >
            {t("coffeeReading.privacyParagraph")}
          </Text>

          <View
            className="mb-6 self-center w-full max-w-[400px] rounded-xl border-2 border-dashed p-4"
            style={{
              borderColor: coffeeAccent,
              backgroundColor: `${theme.colors.surface}CC`,
            }}
          >
            <View className="items-center mb-4 flex-row justify-center gap-3">
              <Ionicons name="cafe" size={28} color={coffeeAccent} />
              <Ionicons name="images-outline" size={26} color={coffeeAccent} />
            </View>
            <Text
              className="text-center text-sm mb-5"
              style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {t("coffeeReading.uploadInstruction")}
            </Text>

            <View className="gap-3 mb-2">
              <Pressable
                onPress={() => void pickImage("cup")}
                className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-full border-2 min-h-[48px]"
                style={{ borderColor: coffeeAccent }}
              >
                <Ionicons name="cafe-outline" size={20} color={coffeeAccent} />
                <Text
                  className="text-base font-semibold flex-1 text-center"
                  style={{ color: coffeeAccent, writingDirection: rtl ? "rtl" : "ltr" }}
                >
                  {t("coffeeReading.uploadCup")}
                </Text>
                {cupBase64 ? <Ionicons name="checkmark-circle" size={22} color={greenCheck} /> : null}
              </Pressable>
              <Pressable
                onPress={() => void pickImage("saucer")}
                className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-full border-2 min-h-[48px]"
                style={{ borderColor: coffeeAccent }}
              >
                <Ionicons name="ellipse-outline" size={20} color={coffeeAccent} />
                <Text
                  className="text-base font-semibold flex-1 text-center"
                  style={{ color: coffeeAccent, writingDirection: rtl ? "rtl" : "ltr" }}
                >
                  {t("coffeeReading.uploadSaucer")}
                </Text>
                {saucerBase64 ? <Ionicons name="checkmark-circle" size={22} color={greenCheck} /> : null}
              </Pressable>
            </View>

            {(cupUri || saucerUri) && (
              <View className="flex-row gap-3 justify-center mt-3 mb-2">
                {cupUri ? (
                  <View className="items-center">
                    <Image
                      source={{ uri: cupUri }}
                      className="h-14 w-14 rounded-xl border"
                      style={{ borderColor: coffeeAccent }}
                      contentFit="cover"
                    />
                    <Text className="text-xs mt-1" style={{ color: tc.textTertiary }}>
                      {t("coffeeReading.guideCup")}
                    </Text>
                  </View>
                ) : null}
                {saucerUri ? (
                  <View className="items-center">
                    <Image
                      source={{ uri: saucerUri }}
                      className="h-14 w-14 rounded-xl border"
                      style={{ borderColor: coffeeAccent }}
                      contentFit="cover"
                    />
                    <Text className="text-xs mt-1" style={{ color: tc.textTertiary }}>
                      {t("coffeeReading.guideSaucer")}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            <Text
              className="text-xs font-semibold uppercase tracking-wide mb-2 mt-2"
              style={{
                color: tc.sectionHeading,
                writingDirection: rtl ? "rtl" : "ltr",
                textAlign: rtl ? "right" : "left",
              }}
            >
              {t("coffeeReading.whatToCapture")}
            </Text>
            <View className="flex-row gap-2 justify-center">
              <View
                className="flex-1 max-w-[140px] items-center rounded-xl border p-4"
                style={{ borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}
              >
                <Ionicons name="cafe" size={32} color={coffeeAccent} />
<Text style={{ color: tc.textSecondary }} className="mt-2 text-center text-xs">{t("coffeeReading.guideCup")}</Text>
                <Ionicons name="checkmark-circle" size={18} color={greenCheck} className="mt-2" />
              </View>
              <View
                className="flex-1 max-w-[140px] items-center rounded-xl border p-4"
                style={{ borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}
              >
                <Ionicons name="ellipse-outline" size={32} color={coffeeAccent} />
<Text style={{ color: tc.textSecondary }} className="mt-2 text-center text-xs">{t("coffeeReading.guideSaucer")}</Text>
                <Ionicons name="checkmark-circle" size={18} color={greenCheck} className="mt-2" />
              </View>
            </View>
          </View>

          <View className="items-center">
            <Button
              title={t("coffeeReading.proceedToReading")}
              onPress={() => void proceedToReading()}
              disabled={!canProceed}
            />
          </View>

          {error ? (
            <Text
              className="text-red-300 mt-4 text-center text-sm"
              style={{ writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {error}
            </Text>
          ) : null}
        </ScrollView>
        ) : null}

      </KeyboardAvoidingView>

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}

      <VoiceListeningOverlay
        visible={coffeeVoice.phase === "listening" && Boolean(data) && phase === "chatting"}
        theme={theme}
        rtl={rtl}
        onStop={() => void coffeeVoice.toggleListening()}
        onCancel={() => coffeeVoice.cancelListening()}
      />
      </View>
    </FeatureAuroraSafeArea>
  );
}

type FutureReportPayload = {
  upcomingThemes: string[];
  timingWindows: string[];
  opportunities: string[];
  risks: string[];
  actionableNow: string;
  confidenceNote: string;
};

function FutureSeerFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const hPad = useChatScreenHorizontalPadding();

  const [domain, setDomain] = useState<"love" | "career" | "health" | "family" | "spirituality" | "general">("general");
  const [window, setWindow] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [data, setData] = useState<FutureReportPayload | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setPaywallOpen(false);
    setData(null);
    try {
      const res = await apiPostJson<FutureReportPayload>("/api/future/report", getToken, { domain, timeWindow: window });
      setData(res);
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(s);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
<Text style={{ color: tc.textPrimary }} className="mb-2 text-2xl font-bold">Future Guidance</Text>

      <View className="mb-2 rounded-xl border border-slate-700 p-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Domain</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["general", "love", "career", "health", "family", "spirituality"] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => setDomain(d)}
              className="min-h-[48px] justify-center rounded-[20px] border px-3 py-2"
              style={{
                borderColor: domain === d ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: domain === d ? theme.colors.surfaceVariant : theme.colors.surface,
              }}
            >
              <Text className="text-sm" style={{ color: tc.textPrimary }}>
                {d}
              </Text>
            </Pressable>
          ))}
        </View>

<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mt-4 mb-2">Window</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["7d", "30d", "90d"] as const).map((w) => (
            <Pressable
              key={w}
              onPress={() => setWindow(w)}
              className="min-h-[48px] justify-center rounded-[20px] border px-3 py-2"
              style={{
                borderColor: window === w ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: window === w ? theme.colors.surfaceVariant : theme.colors.surface,
              }}
            >
              <Text className="text-sm" style={{ color: tc.textPrimary }}>
                {w}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button title={loading ? "Generating…" : "Generate guidance"} onPress={() => void run()} className="mt-4" />
{error ? <Text style={{ color: tc.textSecondary }} className="mt-3">{error}</Text> : null}
      </View>

      {data ? (
        <FlatList
          data={[
            { k: "Upcoming themes", v: (data.upcomingThemes ?? []).join("\n") },
            { k: "Timing windows", v: (data.timingWindows ?? []).join("\n") },
            { k: "Opportunities", v: (data.opportunities ?? []).join("\n") },
            { k: "Risks", v: (data.risks ?? []).join("\n") },
            { k: "Actionable now", v: data.actionableNow },
            { k: "Confidence note", v: data.confidenceNote },
          ]}
          keyExtractor={(i) => i.k}
          renderItem={({ item }) => (
            <View className="mb-2 rounded-xl border border-indigo-800 p-4 bg-slate-950">
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm uppercase tracking-wide">{item.k}</Text>
<Text style={{ color: tc.textPrimary }} className="mt-2 leading-6">{item.v}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <View className="flex-1" />
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </FeatureAuroraSafeArea>
  );
}

export default function FeaturePlaceholderScreen() {
  const { id, prefill } = useLocalSearchParams<FeatureParams>();
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const router = useRouter();
  const hPad = useChatScreenHorizontalPadding();

  const key = FEATURE_KEY_BY_ID[id ?? ""] ?? "main.home";
  const rtl = i18n.language === "fa";

  useEffect(() => {
    if (id) logEvent("feature_opened", { feature_key: id });
  }, [id]);

  if (id === "daily-horoscope") {
    return (
      <DailyHoroscopeFeature
        onAsk={(_p) => router.push("/(main)/ask-me-anything")}
      />
    );
  }

  if (id === "ask-anything") {
    router.replace("/(main)/ask-me-anything");
    return null;
  }

  if (id === "romantic-compatibility") {
    return <CompatibilityFeature />;
  }

  if (id === "personal-growth") {
    return <PersonalGrowthFeature />;
  }

  if (id === "astrological-events") {
    return <AstrologicalEventsFeature />;
  }

  if (id === "life-challenges") {
    return <LifeChallengesFeature />;
  }

  if (id === "tarot-interpreter") {
    return <TarotInterpreterEntryRedirect />;
  }

  if (id === "conflict-advice") {
    return <ConflictAdviceFeature />;
  }

  if (id === "coffee-reading") {
    return <CoffeeReadingFeature />;
  }

  if (id === "dream-interpreter") {
    return <DreamInterpreterFeature />;
  }

  if (id === "future-seer") {
    return <FutureSeerFeature />;
  }

  return (
    <FeatureAuroraSafeArea className="flex-1" style={{ paddingHorizontal: hPad }}>
      <View className="flex-1 items-center justify-center">
        <Text
          className="text-center text-3xl font-semibold"
          style={{ color: tc.textPrimary, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t(key)}
        </Text>
        <Text className="mt-4 text-center text-xl" style={{ color: tc.textSecondary }}>
          {t("common.comingSoon")}
        </Text>
      </View>
    </FeatureAuroraSafeArea>
  );
}
