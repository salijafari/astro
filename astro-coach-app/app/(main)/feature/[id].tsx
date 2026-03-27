import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiGetJson, apiPostJson } from "@/lib/api";
import { logEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/providers/ThemeProvider";
import { useTranslation } from "react-i18next";

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

type CompatibilityProfileRow = {
  id: string;
  name: string;
  relationship: string;
  synastryScore: number | null;
  reportCache: unknown;
};

function BackRow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const rtl = i18n.language === "fa";
  return (
    <Pressable onPress={() => onBack()} className="mb-4 px-2 py-2" accessibilityRole="button" hitSlop={10}>
      <View className="flex-row items-center gap-2">
        <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={22} color={theme.colors.onBackground} />
        <Text style={{ color: theme.colors.onSurfaceVariant }} className="text-base">
          {rtl ? "بازگشت" : t("common.back") ?? "Back"}
        </Text>
      </View>
    </Pressable>
  );
}

function DailyHoroscopeFeature({ onAsk }: { onAsk: (prefill: string) => void }) {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();

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
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold mb-4">{t("common.tryAgain") ?? "Could not load today"}</Text>
          <Text className="text-slate-300">{error}</Text>
          <Button title={t("common.tryAgain") ?? "Try again"} onPress={() => void load()} className="mt-4" />
        </View>
      ) : data ? (
        <View className="flex-1">
          <View className="rounded-3xl border border-indigo-800 p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-indigo-300 text-xs uppercase tracking-wide">{data.moodLabel}</Text>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  onAsk(`Tell me more about my daily horoscope: ${data.title}`);
                }}
                className="px-3 py-2 rounded-2xl"
                style={{ backgroundColor: theme.colors.surface }}
              >
                <Text className="text-indigo-200 text-sm">Ask Akhtar</Text>
              </Pressable>
            </View>
            <Text className="text-white text-2xl font-bold mb-3">{data.title}</Text>
            <Text className="text-slate-200 leading-6">{data.body}</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function AskAnythingFeature({ prefill }: { prefill?: string }) {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const flatListRef = useRef<FlatList<ChatMessageRow>>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [input, setInput] = useState(prefill ?? "");
  const [sending, setSending] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const createSession = async () => {
    const res = await apiPostJson<{ sessionId: string }>("/api/chat/session", getToken, { featureKey: "ask-anything" });
    return res.sessionId;
  };

  const isFreeLimit = (e: unknown) => {
    const s = e instanceof Error ? e.message : String(e);
    return s.includes("free_limit");
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setPaywallOpen(false);

    const userMsg: ChatMessageRow = { id: `u_${Date.now()}`, role: "user", content: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const sid = sessionId ?? (await createSession());
      setSessionId(sid);

      const res = await apiPostJson<{ response: string; followUpPrompts: string[]; conversationId: string }>(
        "/api/chat/complete",
        getToken,
        { message: trimmed, conversationId: sid },
      );

      setMessages((m) => [...m, { id: `a_${Date.now()}`, role: "assistant", content: res.response }]);
      setFollowUps(res.followUpPrompts ?? []);
    } catch (e) {
      if (isFreeLimit(e)) {
        setPaywallOpen(true);
      } else if (e instanceof Error && e.message.includes("onboarding_required")) {
        // #region agent log
        fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',location:'feature/[id].tsx:send catch',message:'onboarding_required caught — about to redirect',data:{errMsg:e.message.slice(0,300)},hypothesisId:'C,D',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setMessages((m) => [
          ...m,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: "Your birth profile is incomplete. Please set it up to continue — I'll take you there now.",
          },
        ]);
        setTimeout(() => router.replace({ pathname: "/(onboarding)/chat-onboarding", params: { returnTo: "ask-anything" } }), 2000);
      } else {
        setMessages((m) => [
          ...m,
          { id: `err_${Date.now()}`, role: "assistant", content: "Sorry — something went wrong. Try again." },
        ]);
      }
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!prefill) return;
    if (messages.length > 0) return;
    void send(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handleViewportResize = () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };
    window.visualViewport?.addEventListener("resize", handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  const header = useMemo(() => {
    if (prefill) return "Ask me anything";
    return "Ask Akhtar";
  }, [prefill]);

  return (
    <SafeAreaView className={`flex-1${Platform.OS === "web" ? " keyboard-aware-container" : ""} bg-slate-950 px-6`}>
      <BackRow onBack={() => router.replace("/(main)/home")} />
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-white text-2xl font-bold">{header}</Text>
        {sending ? <ActivityIndicator color={theme.colors.primary} /> : null}
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 12 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View className={`mb-3 ${isUser ? "items-end" : "items-start"}`}>
              <View
                className={`max-w-[90%] rounded-3xl px-4 py-3 border ${
                  isUser ? "bg-indigo-950 border-indigo-700" : "bg-slate-900 border-slate-700"
                }`}
              >
                <Text className={`${isUser ? "text-indigo-100" : "text-slate-100"} leading-6`}>{item.content}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center flex-1">
            <Text className="text-slate-300 text-center">Ask a question to see your guidance.</Text>
          </View>
        }
      />

      {followUps.length ? (
        <View className="mb-3">
          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Next prompts</Text>
          <View className="flex-row flex-wrap gap-2">
            {followUps.slice(0, 4).map((p) => (
              <Pressable
                key={p}
                onPress={() => void send(p)}
                className="px-3 py-2 rounded-full border border-indigo-800"
                style={{ backgroundColor: theme.colors.surface }}
              >
                <Text className="text-indigo-200 text-sm">{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className={`flex-row items-end gap-2 pb-3${Platform.OS === "web" ? " chat-input-bar" : ""}`}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type your question…"
            placeholderTextColor="#64748b"
            selectionColor="#8b8cff"
            className="flex-1 rounded-2xl border border-slate-700 px-4 py-3 text-white"
            multiline
          />
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              void send(input);
            }}
            className="min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-indigo-600"
            accessibilityRole="button"
          >
            <Ionicons name="send" size={18} color="white" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {paywallOpen ? (
        <PaywallScreen
          context="chat_limit"
          onContinueFree={() => {
            setPaywallOpen(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function CompatibilityFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<CompatibilityProfileRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Partner");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState<string | null>(null);
  const [birthCity, setBirthCity] = useState("");
  const [birthLat, setBirthLat] = useState<number | null>(null);
  const [birthLong, setBirthLong] = useState<number | null>(null);
  const [birthTimezone, setBirthTimezone] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [preds, setPreds] = useState<Array<{ description: string; place_id: string }>>([]);
  const [placeLoading, setPlaceLoading] = useState(false);

  const [activeReport, setActiveReport] = useState<{ profileId: string; score?: number; report?: unknown } | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetJson<{ profiles: CompatibilityProfileRow[] }>("/api/compatibility/profiles", getToken);
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
    let t: ReturnType<typeof setTimeout> | null = null;
    if (q.length < 2) {
      setPreds([]);
      return;
    }
    setPlaceLoading(true);
    t = setTimeout(() => {
      void (async () => {
        try {
          const res = await apiGetJson<{ predictions: Array<{ description: string; place_id: string }> }>(
            `/api/places/autocomplete?q=${encodeURIComponent(q)}`,
            getToken,
          );
          setPreds(res.predictions ?? []);
        } catch {
          setPreds([]);
        } finally {
          setPlaceLoading(false);
        }
      })();
    }, 350);
    return () => {
      if (t) clearTimeout(t);
    };
  }, [q, getToken]);

  const pickPlace = async (p: { place_id: string; description: string }) => {
    setPlaceLoading(true);
    try {
      const d = await apiGetJson<{ birthCity: string; birthLat: number; birthLong: number; birthTimezone: string }>(
        `/api/places/details?place_id=${encodeURIComponent(p.place_id)}`,
        getToken,
      );
      setBirthCity(d.birthCity);
      setBirthLat(d.birthLat);
      setBirthLong(d.birthLong);
      setBirthTimezone(d.birthTimezone);
    } finally {
      setPlaceLoading(false);
    }
  };

  const createProfile = async () => {
    if (!name.trim() || !relationship.trim() || !birthDate.trim() || !birthCity.trim() || birthLat == null || birthLong == null || !birthTimezone) return;
    setPlaceLoading(true);
    try {
      await apiPostJson("/api/compatibility/profile", getToken, {
        name: name.trim(),
        relationship,
        birthDate,
        birthTime,
        birthCity,
        birthLat,
        birthLong,
        birthTimezone,
      });
      setModalOpen(false);
      await load();
    } finally {
      setPlaceLoading(false);
    }
  };

  const generateReport = async (profileId: string) => {
    setPaywallOpen(false);
    setActiveReport(null);
    try {
      const res = await apiPostJson<{ score: number; report: unknown }>("/api/compatibility/report", getToken, { profileId });
      setActiveReport({ profileId, score: res.score, report: res.report });
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(s);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold mb-4">Could not load profiles</Text>
          <Text className="text-slate-300">{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-2xl font-bold">Compatibility</Text>
            <Button title="Add profile" variant="secondary" onPress={() => setModalOpen(true)} />
          </View>

          {profiles.length ? (
            <FlatList
              data={profiles}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-white text-lg font-semibold">{item.name}</Text>
                      <Text className="text-slate-400 mt-1">{item.relationship}</Text>
                    </View>
                    <Text className="text-indigo-200 text-sm font-semibold">
                      {item.synastryScore != null ? `${item.synastryScore}/100` : "—"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void generateReport(item.id)}
                    className="mt-2 rounded-2xl px-4 py-3 border border-indigo-700 items-center"
                    style={{ backgroundColor: theme.colors.surface }}
                  >
                    <Text className="text-indigo-200 text-base font-semibold">Generate report</Text>
                  </Pressable>
                </View>
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-slate-300">No profiles yet.</Text>
              <Pressable onPress={() => setModalOpen(true)} className="mt-4 rounded-2xl px-4 py-3 bg-indigo-600">
                <Text className="text-white font-semibold">Add your first profile</Text>
              </Pressable>
            </View>
          )}

          {activeReport ? (
            <View className="mt-4 rounded-3xl border border-slate-700 p-4">
              <Text className="text-white text-lg font-semibold">Report</Text>
              <Text className="text-indigo-200 mt-1">
                {activeReport.score != null ? `Score: ${activeReport.score}` : ""}
              </Text>
              <Text className="text-slate-200 mt-3" style={{ fontSize: 12 }}>
                {JSON.stringify(activeReport.report, null, 2)}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {modalOpen ? (
        <View className="absolute inset-0 bg-black/60 items-center justify-end p-6">
          <View className="w-full rounded-t-3xl bg-slate-950 border-t border-indigo-800 p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white text-xl font-bold">Add person</Text>
              <Pressable onPress={() => setModalOpen(false)} className="px-3 py-2 rounded-2xl border border-slate-700">
                <Text className="text-slate-300">Close</Text>
              </Pressable>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View className="gap-3">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Name"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-white"
                />
                <TextInput
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="Relationship (e.g. Partner)"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-white"
                />
                <TextInput
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="Birth date (YYYY-MM-DD)"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-white"
                />
                <TextInput
                  value={birthTime ?? ""}
                  onChangeText={(v) => setBirthTime(v ? v : null)}
                  placeholder="Birth time (HH:MM optional)"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-white"
                />

                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search birth city"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3 text-white"
                />
                {placeLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
                {preds.length ? (
                  <FlatList
                    data={preds}
                    keyExtractor={(p) => p.place_id}
                    style={{ maxHeight: 180 }}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => void pickPlace(item)} className="py-3 border-b border-slate-800">
                        <Text className="text-slate-200">{item.description}</Text>
                      </Pressable>
                    )}
                  />
                ) : null}

                {birthCity ? <Text className="text-indigo-200">{`Selected: ${birthCity}`}</Text> : null}

                <View className="flex-row gap-3 mt-2">
                  <Button title="Add" onPress={() => void createProfile()} className="flex-1" />
                  <Button title="Cancel" variant="ghost" onPress={() => setModalOpen(false)} className="flex-1" />
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      ) : null}

      {paywallOpen ? (
        <PaywallScreen
          context="compatibility"
          onContinueFree={() => {
            setPaywallOpen(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

type JournalEntryRow = {
  id: string;
  content: string;
  moodTag: string | null;
  promptUsed: string | null;
  createdAt: string | Date;
};

function PersonalGrowthFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [promptLoading, setPromptLoading] = useState(true);
  const [journalPrompt, setJournalPrompt] = useState<string>("");
  const [journalText, setJournalText] = useState<string>("");
  const [entries, setEntries] = useState<JournalEntryRow[]>([]);
  const [timeline, setTimeline] = useState<Array<{ id: string; entryType: string; theme?: string | null; summary?: string | null; date: string | Date }>>([]);

  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, eRes, tRes] = await Promise.all([
        apiGetJson<{ prompt: string }>("/api/journal/prompt", getToken),
        apiGetJson<{ entries: JournalEntryRow[] }>("/api/journal/entries", getToken),
        apiGetJson<{ entries: Array<{ id: string; entryType: string; theme?: string | null; summary?: string | null; date: string | Date }> }>(
          "/api/timeline",
          getToken,
        ),
      ]);
      setJournalPrompt(pRes.prompt);
      setEntries(eRes.entries ?? []);
      setTimeline(tRes.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setLoading(false);
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

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold mb-4">Could not load growth</Text>
          <Text className="text-slate-300">{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="rounded-3xl border border-indigo-800 p-5 mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white text-2xl font-bold">Personal Growth</Text>
              <Text className="text-indigo-200 text-sm font-semibold">{`Streak: ${streakDays} entries (7d)`}</Text>
            </View>
            <Text className="text-slate-300 text-sm mb-2">Today’s journal prompt</Text>
            <Text className="text-white leading-6">{journalPrompt}</Text>
          </View>

          <View className="rounded-3xl border border-slate-700 p-5 mb-4">
            <Text className="text-white text-lg font-semibold mb-2">Write your entry</Text>
            <TextInput
              value={journalText}
              onChangeText={setJournalText}
              placeholder="Take a breath and write…"
              placeholderTextColor="#64748b"
              selectionColor="#8b8cff"
              className="rounded-2xl border border-slate-700 px-4 py-3 text-white min-h-[120px]"
              multiline
            />
            <View className="flex-row gap-3 mt-3">
              <Button title="Save entry" onPress={() => void saveEntry()} className="flex-1" />
              <Button title="Generate weekly digest" variant="secondary" onPress={() => void generateWeeklyDigest()} className="flex-1" />
            </View>
          </View>

          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Recent journal</Text>
          <FlatList
            data={entries.slice(0, 6)}
            keyExtractor={(e) => e.id}
            className="mb-4"
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-slate-800 p-4 bg-slate-950">
                <Text className="text-white text-sm font-semibold">{new Date(item.createdAt).toLocaleDateString()}</Text>
                <Text className="text-slate-200 mt-2 leading-6">{item.content}</Text>
              </View>
            )}
          />

          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Weekly digest</Text>
          <FlatList
            data={timeline.slice(0, 6)}
            keyExtractor={(t) => t.id}
            className="flex-1"
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-slate-800 p-4 bg-slate-950">
                <Text className="text-white text-sm font-semibold">{item.entryType}</Text>
                {item.theme ? <Text className="text-indigo-200 mt-1">{item.theme}</Text> : null}
                {item.summary ? <Text className="text-slate-200 mt-2 leading-6">{item.summary}</Text> : null}
              </View>
            )}
          />
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
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
  const router = useRouter();

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
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold mb-4">Could not load events</Text>
          <Text className="text-slate-300">{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <Text className="text-white text-2xl font-bold mb-4">Astrological Events</Text>
          <FlatList
            data={events}
            keyExtractor={(e, idx) => `${idx}_${e.title}`}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-lg font-semibold">{item.title}</Text>
                  <Text className="text-indigo-200 text-sm font-semibold">{item.significance}/100</Text>
                </View>
                <Text className="text-slate-400">{item.category}</Text>
                {item.eventDate ? (
                  <Text className="text-slate-400 mt-1">{new Date(item.eventDate).toLocaleDateString()}</Text>
                ) : null}
                <Text className="text-slate-200 mt-3 leading-6">{item.whyItMatters}</Text>
                <Text className="text-indigo-200 mt-2 leading-6">{`Action: ${item.suggestedAction}`}</Text>
              </View>
            )}
            ListEmptyComponent={<Text className="text-slate-300">No events available.</Text>}
          />
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
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
  const router = useRouter();

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
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold mb-4">Could not load challenges</Text>
          <Text className="text-slate-300">{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <Text className="text-white text-2xl font-bold mb-3">Life Challenges</Text>
          <View className="rounded-3xl border border-slate-700 p-4 mb-4">
            <Text className="text-slate-300 text-sm uppercase tracking-wide mb-2">Interpretation</Text>
            <Text className="text-slate-200 leading-6">{interpretation}</Text>
          </View>

          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Clusters</Text>
          <FlatList
            data={clusters}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
                <View className="flex-row items-center justify-between">
                  <Text className="text-white text-lg font-semibold">{item.id.replace(/_/g, " ")}</Text>
                  <Text className="text-indigo-200 text-sm font-semibold">{Math.round(item.confidence * 100)}%</Text>
                </View>
                <Text className="text-slate-400 mt-2">Evidence</Text>
                <Text className="text-slate-200 mt-2 leading-6" style={{ fontSize: 12 }}>
                  {item.evidence.join(" · ")}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text className="text-slate-300">No clusters found.</Text>}
          />

          {hiddenStrengths.length ? (
            <View className="rounded-3xl border border-slate-700 p-4 mt-3">
              <Text className="text-slate-300 text-sm uppercase tracking-wide mb-2">Hidden strengths</Text>
              <Text className="text-slate-200 leading-6">{hiddenStrengths.join("\n")}</Text>
            </View>
          ) : null}

          {practicePrompts.length ? (
            <View className="rounded-3xl border border-slate-700 p-4 mt-3">
              <Text className="text-slate-300 text-sm uppercase tracking-wide mb-2">Practice prompts</Text>
              <Text className="text-slate-200 leading-6">{practicePrompts.join("\n")}</Text>
            </View>
          ) : null}
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
  );
}

type TarotCardRow = {
  name: string;
  arcana: "major" | "minor";
  upright_meaning: string;
  reversed_meaning: string;
  astrological_association: string;
  keywords: string[];
  reversed?: boolean;
};

function TarotInterpreterFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [spread, setSpread] = useState<"single" | "three" | "celtic">("single");
  const [intention, setIntention] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [readingSummary, setReadingSummary] = useState<string>("");
  const [cards, setCards] = useState<TarotCardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const read = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPostJson<{ cards: TarotCardRow[]; summary: string }>("/api/tarot/reading", getToken, {
        spread,
        intention: intention.trim() ? intention.trim() : undefined,
      });
      setCards(res.cards ?? []);
      setReadingSummary(res.summary ?? "");
      setExpanded({});
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      setError(s);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      <Text className="text-white text-2xl font-bold mb-3">Tarot Reading</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
        <Text className="text-slate-300 text-sm uppercase tracking-wide mb-2">Spread</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["single", "three", "celtic"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpread(s)}
              className="px-3 py-2 rounded-full border"
              style={{
                borderColor: spread === s ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: spread === s ? theme.colors.surfaceVariant : theme.colors.surface,
              }}
            >
              <Text className="text-slate-100 text-sm">{s === "single" ? "Single" : s === "three" ? "Three" : "Celtic"}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={intention}
          onChangeText={setIntention}
          placeholder="Intention (optional)"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          className="mt-3 rounded-2xl border border-slate-700 px-4 py-3 text-white"
        />

        <Button title={loading ? "Reading…" : "Draw cards"} onPress={() => void read()} className="mt-3" />
        {error ? <Text className="text-slate-300 mt-3">{error}</Text> : null}
      </View>

      {readingSummary ? (
        <View className="rounded-3xl border border-indigo-800 p-4 mb-4">
          <Text className="text-indigo-200 text-sm uppercase tracking-wide mb-2">Summary</Text>
          <Text className="text-slate-200 leading-6">{readingSummary}</Text>
        </View>
      ) : null}

      <FlatList
        data={cards}
        keyExtractor={(c, idx) => `${c.name}_${idx}`}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item, index }) => {
          const key = `${item.name}_${index}`;
          const isOpen = expanded[key];
          const meaning = item.reversed ? item.reversed_meaning : item.upright_meaning;
          return (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync().catch(() => {});
                setExpanded((m) => ({ ...m, [key]: !m[key] }));
              }}
              className="mb-3 rounded-3xl border border-slate-700 p-4"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-lg font-semibold">{item.name}</Text>
                <Text className="text-indigo-200 text-sm font-semibold">{item.arcana}</Text>
              </View>
              <Text className="text-slate-400 mt-2">{item.astrological_association}</Text>
              {!isOpen ? (
                <View className="mt-3">
                  <Text className="text-slate-300 text-sm">{item.keywords.slice(0, 4).join(", ")}</Text>
                  <Text className="text-indigo-200 mt-2 text-sm">Tap to reveal meaning</Text>
                </View>
              ) : (
                <View className="mt-3">
                  <Text className="text-slate-200 leading-6">{meaning}</Text>
                  <Text className="text-slate-400 text-xs uppercase tracking-wide mt-3">
                    {item.reversed ? "Reversed" : "Upright"}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text className="text-slate-300">Draw a spread to begin.</Text>}
      />
    </SafeAreaView>
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
  const router = useRouter();
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
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      <Text className="text-white text-2xl font-bold mb-3">Conflict Advice</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Describe the conflict (what happened, what you want)…"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          className="rounded-2xl border border-slate-700 px-4 py-3 text-white min-h-[120px]"
          multiline
        />
        <Button title={loading ? "Thinking…" : "Get advice"} onPress={() => void submit()} className="mt-3" />
        {error ? <Text className="text-slate-300 mt-3">{error}</Text> : null}
      </View>

      {data && "error" in data && data.error === "unsafe" ? (
        <View className="rounded-3xl border border-indigo-800 p-4">
          <Text className="text-indigo-200 text-sm uppercase tracking-wide mb-2">Safety note</Text>
          <Text className="text-slate-200 leading-6">{data.response}</Text>
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
            <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
              <Text className="text-indigo-200 text-sm uppercase tracking-wide">{item.k}</Text>
              <Text className="text-slate-200 mt-2 leading-6">{item.v}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <View className="flex-1" />
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
  );
}

type CoffeeReadingPayload = {
  visionObservations: string[];
  symbolicMappings: Array<{ symbol: string; meaning: string }>;
  interpretation: string;
  followUpQuestions: string[];
  imageQualityFlag: boolean;
};

function CoffeeReadingFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [data, setData] = useState<CoffeeReadingPayload | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const pickAndRead = async () => {
    setLoading(true);
    setError(null);
    setPaywallOpen(false);
    setData(null);
    setLocalPreview(null);

    try {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        base64: true,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        setError("Could not read image. Please try again.");
        return;
      }

      const mime = asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      setLocalPreview(asset.uri ?? null);

      const uploaded = await apiPostJson<{ imageUrl: string }>("/api/files/upload", getToken, { dataUrl });
      const reading = await apiPostJson<CoffeeReadingPayload>("/api/coffee/reading", getToken, { imageUrl: uploaded.imageUrl });
      setData(reading);
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(s);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      <Text className="text-white text-2xl font-bold mb-3">Coffee Reading</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
        <Text className="text-slate-300 leading-6">
          Upload a clear photo of the cup patterns. For privacy, we store the image only for the reading record.
        </Text>
        <Button title={loading ? "Reading…" : "Choose photo"} onPress={() => void pickAndRead()} className="mt-3" />
        {error ? <Text className="text-slate-300 mt-3">{error}</Text> : null}
      </View>

      {data ? (
        <FlatList
          data={[
            { k: "Interpretation", v: data.interpretation },
            { k: "Observations", v: (data.visionObservations ?? []).join(" · ") },
            {
              k: "Symbols",
              v: (data.symbolicMappings ?? []).map((m) => `${m.symbol}: ${m.meaning}`).join("\n"),
            },
            { k: "Follow-ups", v: (data.followUpQuestions ?? []).join("\n") },
          ]}
          keyExtractor={(i) => i.k}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
              <Text className="text-indigo-200 text-sm uppercase tracking-wide">{item.k}</Text>
              <Text className="text-slate-200 mt-2 leading-6">{item.v}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <View className="flex-1" />
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
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
  const router = useRouter();

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
    <SafeAreaView className="flex-1 bg-slate-950 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      <Text className="text-white text-2xl font-bold mb-3">Future Guidance</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
        <Text className="text-slate-300 text-sm uppercase tracking-wide mb-2">Domain</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["general", "love", "career", "health", "family", "spirituality"] as const).map((d) => (
            <Pressable
              key={d}
              onPress={() => setDomain(d)}
              className="px-3 py-2 rounded-full border"
              style={{
                borderColor: domain === d ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: domain === d ? theme.colors.surfaceVariant : theme.colors.surface,
              }}
            >
              <Text className="text-slate-100 text-sm">{d}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-slate-300 text-sm uppercase tracking-wide mt-4 mb-2">Window</Text>
        <View className="flex-row flex-wrap gap-2">
          {(["7d", "30d", "90d"] as const).map((w) => (
            <Pressable
              key={w}
              onPress={() => setWindow(w)}
              className="px-3 py-2 rounded-full border"
              style={{
                borderColor: window === w ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: window === w ? theme.colors.surfaceVariant : theme.colors.surface,
              }}
            >
              <Text className="text-slate-100 text-sm">{w}</Text>
            </Pressable>
          ))}
        </View>

        <Button title={loading ? "Generating…" : "Generate guidance"} onPress={() => void run()} className="mt-4" />
        {error ? <Text className="text-slate-300 mt-3">{error}</Text> : null}
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
            <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
              <Text className="text-indigo-200 text-sm uppercase tracking-wide">{item.k}</Text>
              <Text className="text-slate-200 mt-2 leading-6">{item.v}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      ) : (
        <View className="flex-1" />
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </SafeAreaView>
  );
}

export default function FeaturePlaceholderScreen() {
  const { id, prefill } = useLocalSearchParams<FeatureParams>();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();

  const key = FEATURE_KEY_BY_ID[id ?? ""] ?? "main.home";
  const rtl = i18n.language === "fa";

  useEffect(() => {
    if (id) logEvent("feature_opened", { feature_key: id });
  }, [id]);

  if (id === "daily-horoscope") {
    return (
      <DailyHoroscopeFeature
        onAsk={(p) =>
          router.push({ pathname: "/(main)/feature/[id]", params: { id: "ask-anything", prefill: p } })
        }
      />
    );
  }

  if (id === "ask-anything") {
    return <AskAnythingFeature prefill={prefill} />;
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
    return <TarotInterpreterFeature />;
  }

  if (id === "conflict-advice") {
    return <ConflictAdviceFeature />;
  }

  if (id === "coffee-reading") {
    return <CoffeeReadingFeature />;
  }

  if (id === "future-seer") {
    return <FutureSeerFeature />;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <View className="flex-1 items-center justify-center px-6">
        <Text
          className="text-center text-3xl font-semibold"
          style={{ color: theme.colors.onBackground, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {t(key)}
        </Text>
        <Text className="mt-4 text-center text-xl" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("common.comingSoon")}
        </Text>
      </View>
    </SafeAreaView>
  );
}
