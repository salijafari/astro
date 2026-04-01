import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuroraSafeArea } from "@/components/CosmicBackground";
import { apiGetJson, apiPostJson } from "@/lib/api";
import { logEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { PaywallScreen } from "@/components/coaching/PaywallScreen";
import { Button } from "@/components/ui/Button";
import { getFeatureConfig } from "@/lib/featureConfig";
import { useThemeColors } from "@/lib/themeColors";
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

type CompatibilityProfileRow = {
  id: string;
  name: string;
  relationship: string;
  synastryScore: number | null;
  reportCache: unknown;
};

function BackRow({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const rtl = i18n.language === "fa";
  return (
    <Pressable onPress={() => onBack()} className="mb-4 px-2 py-2" accessibilityRole="button" hitSlop={10}>
      <View className="flex-row items-center gap-2">
        <Ionicons name={rtl ? "arrow-forward" : "arrow-back"} size={22} color={tc.navIcon} />
        <Text style={{ color: tc.textSecondary }} className="text-base">
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
  const tc = useThemeColors();
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
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
          <View className="rounded-3xl border border-indigo-800 p-5">
            <View className="flex-row items-center justify-between mb-3">
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-xs uppercase tracking-wide">{data.moodLabel}</Text>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  onAsk(`Tell me more about my daily horoscope: ${data.title}`);
                }}
                className="px-3 py-2 rounded-2xl"
                style={{ backgroundColor: theme.colors.surface }}
              >
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm">Ask Akhtar</Text>
              </Pressable>
            </View>
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold mb-3">{data.title}</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{data.body}</Text>
          </View>
        </View>
      ) : null}
    </AuroraSafeArea>
  );
}

function CompatibilityFeature() {
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-4">Could not load profiles</Text>
<Text style={{ color: tc.textSecondary }} >{error}</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-4">
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold">Compatibility</Text>
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
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold">{item.name}</Text>
<Text style={{ color: tc.textSecondary }} className="mt-1">{item.relationship}</Text>
                    </View>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">
                      {item.synastryScore != null ? `${item.synastryScore}/100` : "—"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void generateReport(item.id)}
                    className="mt-2 rounded-2xl px-4 py-3 border border-indigo-700 items-center"
                    style={{ backgroundColor: theme.colors.surface }}
                  >
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-base font-semibold">Generate report</Text>
                  </Pressable>
                </View>
              )}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
<Text style={{ color: tc.textSecondary }} >No profiles yet.</Text>
              <Pressable onPress={() => setModalOpen(true)} className="mt-4 rounded-2xl px-4 py-3 bg-indigo-600">
<Text style={{ color: tc.textPrimary }} className="font-semibold">Add your first profile</Text>
              </Pressable>
            </View>
          )}

          {activeReport ? (
            <View className="mt-4 rounded-3xl border border-slate-700 p-4">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold">Report</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="mt-1">
                {activeReport.score != null ? `Score: ${activeReport.score}` : ""}
              </Text>
              <Text className="mt-3" style={{ fontSize: 12, color: tc.textPrimary }}>
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
<Text style={{ color: tc.textPrimary }} className="text-xl font-bold">Add person</Text>
              <Pressable onPress={() => setModalOpen(false)} className="px-3 py-2 rounded-2xl border border-slate-700">
<Text style={{ color: tc.textSecondary }} >Close</Text>
              </Pressable>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View className="gap-3">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Name"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3"
                  style={{ color: tc.textPrimary }}
                />
                <TextInput
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="Relationship (e.g. Partner)"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3"
                  style={{ color: tc.textPrimary }}
                />
                <TextInput
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="Birth date (YYYY-MM-DD)"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3"
                  style={{ color: tc.textPrimary }}
                />
                <TextInput
                  value={birthTime ?? ""}
                  onChangeText={(v) => setBirthTime(v ? v : null)}
                  placeholder="Birth time (HH:MM optional)"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3"
                  style={{ color: tc.textPrimary }}
                />

                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search birth city"
                  placeholderTextColor="#64748b"
                  className="rounded-2xl border border-slate-700 px-4 py-3"
                  style={{ color: tc.textPrimary }}
                />
                {placeLoading ? <ActivityIndicator color={theme.colors.primary} /> : null}
                {preds.length ? (
                  <FlatList
                    data={preds}
                    keyExtractor={(p) => p.place_id}
                    style={{ maxHeight: 180 }}
                    renderItem={({ item }) => (
                      <Pressable onPress={() => void pickPlace(item)} className="py-3 border-b border-slate-800">
<Text style={{ color: tc.textPrimary }} >{item.description}</Text>
                      </Pressable>
                    )}
                  />
                ) : null}

{birthCity ? <Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} >{`Selected: ${birthCity}`}</Text> : null}

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
    </AuroraSafeArea>
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
  const tc = useThemeColors();
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
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
          <View className="rounded-3xl border border-indigo-800 p-5 mb-4">
            <View className="flex-row items-center justify-between mb-2">
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold">Personal Growth</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">{`Streak: ${streakDays} entries (7d)`}</Text>
            </View>
<Text style={{ color: tc.textSecondary }} className="text-sm mb-2">Today’s journal prompt</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{journalPrompt}</Text>
          </View>

          <View className="rounded-3xl border border-slate-700 p-5 mb-4">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold mb-2">Write your entry</Text>
            <TextInput
              value={journalText}
              onChangeText={setJournalText}
              placeholder="Take a breath and write…"
              placeholderTextColor="#64748b"
              selectionColor="#8b8cff"
              className="rounded-2xl border border-slate-700 px-4 py-3 min-h-[120px]"
          style={{ color: tc.textPrimary }}
              multiline
            />
            <View className="flex-row gap-3 mt-3">
              <Button title="Save entry" onPress={() => void saveEntry()} className="flex-1" />
              <Button title="Generate weekly digest" variant="secondary" onPress={() => void generateWeeklyDigest()} className="flex-1" />
            </View>
          </View>

<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mb-2">Recent journal</Text>
          <FlatList
            data={entries.slice(0, 6)}
            keyExtractor={(e) => e.id}
            className="mb-4"
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-slate-800 p-4 bg-slate-950">
<Text style={{ color: tc.textPrimary }} className="text-sm font-semibold">{new Date(item.createdAt).toLocaleDateString()}</Text>
<Text style={{ color: tc.textPrimary }} className="mt-2 leading-6">{item.content}</Text>
              </View>
            )}
          />

<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mb-2">Weekly digest</Text>
          <FlatList
            data={timeline.slice(0, 6)}
            keyExtractor={(t) => t.id}
            className="flex-1"
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-slate-800 p-4 bg-slate-950">
<Text style={{ color: tc.textPrimary }} className="text-sm font-semibold">{item.entryType}</Text>
{item.theme ? <Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="mt-1">{item.theme}</Text> : null}
{item.summary ? <Text style={{ color: tc.textPrimary }} className="mt-2 leading-6">{item.summary}</Text> : null}
              </View>
            )}
          />
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </AuroraSafeArea>
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
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
              <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
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
    </AuroraSafeArea>
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
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
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold mb-3">Life Challenges</Text>
          <View className="rounded-3xl border border-slate-700 p-4 mb-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Interpretation</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{interpretation}</Text>
          </View>

<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mb-2">Clusters</Text>
          <FlatList
            data={clusters}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
                <View className="flex-row items-center justify-between">
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold">{item.id.replace(/_/g, " ")}</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">{Math.round(item.confidence * 100)}%</Text>
                </View>
<Text style={{ color: tc.textSecondary }} className="mt-2">Evidence</Text>
                <Text className="mt-2 leading-6" style={{ fontSize: 12, color: tc.textTertiary }}>
                  {item.evidence.join(" · ")}
                </Text>
              </View>
            )}
ListEmptyComponent={<Text style={{ color: tc.textSecondary }} >No clusters found.</Text>}
          />

          {hiddenStrengths.length ? (
            <View className="rounded-3xl border border-slate-700 p-4 mt-3">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Hidden strengths</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{hiddenStrengths.join("\n")}</Text>
            </View>
          ) : null}

          {practicePrompts.length ? (
            <View className="rounded-3xl border border-slate-700 p-4 mt-3">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Practice prompts</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{practicePrompts.join("\n")}</Text>
            </View>
          ) : null}
        </View>
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </AuroraSafeArea>
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
  const tc = useThemeColors();
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold mb-3">Tarot Reading</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Spread</Text>
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
              <Text className="text-sm" style={{ color: tc.textPrimary }}>
                {s === "single" ? "Single" : s === "three" ? "Three" : "Celtic"}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={intention}
          onChangeText={setIntention}
          placeholder="Intention (optional)"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          className="mt-3 rounded-2xl border border-slate-700 px-4 py-3"
          style={{ color: tc.textPrimary }}
        />

        <Button title={loading ? "Reading…" : "Draw cards"} onPress={() => void read()} className="mt-3" />
{error ? <Text style={{ color: tc.textSecondary }} className="mt-3">{error}</Text> : null}
      </View>

      {readingSummary ? (
        <View className="rounded-3xl border border-indigo-800 p-4 mb-4">
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm uppercase tracking-wide mb-2">Summary</Text>
<Text style={{ color: tc.textPrimary }} className="leading-6">{readingSummary}</Text>
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
<Text style={{ color: tc.textPrimary }} className="text-lg font-semibold">{item.name}</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="text-sm font-semibold">{item.arcana}</Text>
              </View>
<Text style={{ color: tc.textSecondary }} className="mt-2">{item.astrological_association}</Text>
              {!isOpen ? (
                <View className="mt-3">
<Text style={{ color: tc.textSecondary }} className="text-sm">{item.keywords.slice(0, 4).join(", ")}</Text>
<Text style={{ color: tc.isDark ? '#a5b4fc' : '#4338ca' }} className="mt-2 text-sm">Tap to reveal meaning</Text>
                </View>
              ) : (
                <View className="mt-3">
<Text style={{ color: tc.textPrimary }} className="leading-6">{meaning}</Text>
<Text style={{ color: tc.textSecondary }} className="text-xs uppercase tracking-wide mt-3">
                    {item.reversed ? "Reversed" : "Upright"}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
ListEmptyComponent={<Text style={{ color: tc.textSecondary }} >Draw a spread to begin.</Text>}
      />
    </AuroraSafeArea>
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold mb-3">Conflict Advice</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Describe the conflict (what happened, what you want)…"
          placeholderTextColor="#64748b"
          selectionColor="#8b8cff"
          className="rounded-2xl border border-slate-700 px-4 py-3 min-h-[120px]"
          style={{ color: tc.textPrimary }}
          multiline
        />
        <Button title={loading ? "Thinking…" : "Get advice"} onPress={() => void submit()} className="mt-3" />
{error ? <Text style={{ color: tc.textSecondary }} className="mt-3">{error}</Text> : null}
      </View>

      {data && "error" in data && data.error === "unsafe" ? (
        <View className="rounded-3xl border border-indigo-800 p-4">
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
            <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
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
    </AuroraSafeArea>
  );
}

type CoffeeReadingPayload = {
  visionObservations: string[];
  symbolicMappings: Array<{ symbol: string; meaning: string }>;
  interpretation: string;
  followUpQuestions: string[];
  imageQualityFlag: boolean;
};

const DREAM_MAX_CHARS = 2000;

type FollowUpMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
};

function DreamInterpreterFeature() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const { theme } = useTheme();
  const tc = useThemeColors();
  const router = useRouter();
  const rtl = i18n.language.startsWith("fa");
  const [phase, setPhase] = useState<"input" | "loading" | "result" | "error" | "chatting">("input");
  const [dreamText, setDreamText] = useState("");
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [followUpMessages, setFollowUpMessages] = useState<FollowUpMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState("");
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const followUpListRef = useRef<FlatList<FollowUpMessage>>(null);

  const trimmed = dreamText.trim();
  const canSubmit = trimmed.length >= 10 && dreamText.length <= DREAM_MAX_CHARS;

  const resetToInput = () => {
    setPhase("input");
    setDreamText("");
    setInterpretation(null);
    setErrorMessage(null);
    setSessionId(null);
    setFollowUpMessages([]);
    setFollowUpInput("");
    setIsFollowUpLoading(false);
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
    if (!text || isFollowUpLoading || !sessionId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const loadingId = `loading_${Date.now()}`;
    setFollowUpMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", content: text },
      { id: loadingId, role: "assistant", content: "", isLoading: true },
    ]);
    setFollowUpInput("");
    setIsFollowUpLoading(true);
    try {
      type FollowUpResponse = { content?: string; response?: string };
      const data = await apiPostJson<FollowUpResponse>("/api/chat/message", getToken, {
        sessionId,
        content: text,
        featureKey: "dream_interpreter",
      });
      const reply = data.content ?? data.response ?? t("dreamInterpreter.genericError");
      setFollowUpMessages((prev) =>
        prev.map((m) => (m.id === loadingId ? { ...m, content: reply, isLoading: false } : m)),
      );
    } catch {
      setFollowUpMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId ? { ...m, content: t("common.tryAgain"), isLoading: false } : m,
        ),
      );
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  /** Chat messages shown in the chatting phase: interpretation first, then follow-ups. */
  const chattingData: FollowUpMessage[] = interpretation
    ? [{ id: "interpretation", role: "assistant", content: interpretation }, ...followUpMessages]
    : followUpMessages;

  return (
    <AuroraSafeArea className="flex-1 px-6">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <BackRow onBack={() => router.replace("/(main)/home")} />

        {phase === "input" ? (
          <View className="flex-1">
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
              className="rounded-2xl border border-slate-600 px-4 py-3 text-base"
              style={{
                color: tc.textPrimary,
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
            <Button
              title={t("dreamInterpreter.interpretCta")}
              onPress={() => void interpret()}
              disabled={!canSubmit}
            />
          </View>
        ) : null}

        {phase === "loading" ? (
          <View className="flex-1 items-center justify-center py-16">
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text
              className="mt-6 text-center px-4"
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
                className="leading-7 mb-4"
                style={{
                  color: tc.textPrimary,
                  writingDirection: rtl ? "rtl" : "ltr",
                  textAlign: rtl ? "right" : "left",
                }}
              >
                {item}
              </Text>
            )}
            contentContainerStyle={{ paddingBottom: 32 }}
            ListFooterComponent={
              <View className="gap-3 mt-2">
                <Button title={t("dreamInterpreter.followUp")} onPress={onFollowUp} />
                <Button title={t("dreamInterpreter.anotherDream")} onPress={resetToInput} />
              </View>
            }
          />
        ) : null}

        {phase === "error" ? (
          <View className="flex-1">
            <Text
              className="text-lg leading-7 mb-6"
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
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable
                onPress={() => setPhase("result")}
                hitSlop={10}
                className="flex-row items-center gap-1"
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
                className="text-xs flex-1 text-right ml-3"
                numberOfLines={1}
                style={{ color: theme.colors.onSurfaceVariant, textAlign: rtl ? "left" : "right" }}
              >
                {t("dreamInterpreter.dreamSummaryLabel")}
              </Text>
            </View>

            {/* Dream summary pill */}
            <View
              className="rounded-xl px-3 py-2 mb-3"
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
              renderItem={({ item }) => {
                const isUser = item.role === "user";
                return (
                  <View className={`mb-3 ${isUser ? "items-end" : "items-start"}`}>
                    <View
                      className="max-w-[90%] rounded-3xl px-4 py-3 border"
                      style={{
                        borderColor: isUser ? theme.colors.primary : theme.colors.outline,
                        backgroundColor: isUser
                          ? theme.colors.primaryContainer
                          : theme.colors.surface,
                      }}
                    >
                      {item.isLoading ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.onSurfaceVariant}
                        />
                      ) : (
                        <Text
                          className="text-base leading-6"
                          style={{
                            color: isUser
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onBackground,
                            writingDirection: rtl ? "rtl" : "ltr",
                          }}
                        >
                          {item.content}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              }}
            />

            {/* Follow-up input */}
            <View
              className="flex-row items-end gap-2 pt-2 pb-1 border-t"
              style={{ borderColor: theme.colors.outlineVariant }}
            >
              <TextInput
                value={followUpInput}
                onChangeText={setFollowUpInput}
                placeholder={t("dreamInterpreter.followUpPlaceholder")}
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline
                textAlignVertical="top"
                className="flex-1 rounded-2xl border px-4 py-3 text-base"
                style={{
                  maxHeight: 100,
                  borderColor: theme.colors.outline,
                  color: theme.colors.onBackground,
                  writingDirection: rtl ? "rtl" : "ltr",
                  textAlign: rtl ? "right" : "left",
                }}
                returnKeyType="send"
                onSubmitEditing={() => void handleSendFollowUp()}
              />
              <Pressable
                onPress={() => void handleSendFollowUp()}
                disabled={isFollowUpLoading || !followUpInput.trim() || !sessionId}
                className="rounded-full p-3"
                style={{
                  backgroundColor:
                    isFollowUpLoading || !followUpInput.trim() || !sessionId
                      ? theme.colors.surfaceVariant
                      : theme.colors.primary,
                }}
              >
                <Ionicons
                  name="send"
                  size={18}
                  color={
                    isFollowUpLoading || !followUpInput.trim() || !sessionId
                      ? theme.colors.onSurfaceVariant
                      : theme.colors.onPrimary
                  }
                />
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </AuroraSafeArea>
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
  const router = useRouter();
  const rtl = i18n.language.startsWith("fa");
  const apiLanguage = rtl ? "fa" : "en";
  const coffeeAccent = getFeatureConfig("coffee_reading").color;
  const greenCheck = "#34d399";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [data, setData] = useState<CoffeeReadingPayload | null>(null);

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
    try {
      const reading = await apiPostJson<CoffeeReadingPayload & { sessionId?: string }>("/api/coffee/reading", getToken, {
        imageBase64: cupBase64!,
        mimeType: cupMime,
        saucerImageBase64: saucerBase64!,
        saucerMimeType: saucerMime,
        language: apiLanguage,
      });
      setData(reading);
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e);
      if (s.includes("premium_required")) setPaywallOpen(true);
      else setError(mapCoffeeApiError(s));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraSafeArea className="flex-1">
      <BackRow onBack={() => router.replace("/(main)/home")} />
      {loading && !data ? (
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text
            className="mt-6 text-center"
            style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
          >
            {t("coffeeReading.reading")}
          </Text>
        </View>
      ) : data ? (
        <FlatList
          data={[
            { k: t("coffeeReading.sectionInterpretation"), v: data.interpretation },
            { k: t("coffeeReading.sectionObservations"), v: (data.visionObservations ?? []).join(" · ") },
            {
              k: t("coffeeReading.sectionSymbols"),
              v: (data.symbolicMappings ?? []).map((m) => `${m.symbol}: ${m.meaning}`).join("\n"),
            },
            { k: t("coffeeReading.sectionFollowUps"), v: (data.followUpQuestions ?? []).join("\n") },
          ]}
          keyExtractor={(i) => i.k}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
              <Text
                className="text-indigo-200 text-sm uppercase tracking-wide"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {item.k}
              </Text>
              <Text
                className="text-slate-200 mt-2 leading-6"
                style={{ writingDirection: rtl ? "rtl" : "ltr", textAlign: rtl ? "right" : "left" }}
              >
                {item.v}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
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
            className="rounded-3xl border-2 border-dashed p-5 mb-6 self-center w-full max-w-[400px]"
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
                      style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: coffeeAccent }}
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
                      style={{ width: 56, height: 56, borderRadius: 10, borderWidth: 1, borderColor: coffeeAccent }}
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
            <View className="flex-row gap-3 justify-center">
              <View
                className="flex-1 rounded-2xl border p-3 items-center max-w-[140px]"
                style={{ borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}
              >
                <Ionicons name="cafe" size={32} color={coffeeAccent} />
<Text style={{ color: tc.textSecondary }} className="text-xs mt-2 text-center">{t("coffeeReading.guideCup")}</Text>
                <Ionicons name="checkmark-circle" size={18} color={greenCheck} style={{ marginTop: 6 }} />
              </View>
              <View
                className="flex-1 rounded-2xl border p-3 items-center max-w-[140px]"
                style={{ borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}
              >
                <Ionicons name="ellipse-outline" size={32} color={coffeeAccent} />
<Text style={{ color: tc.textSecondary }} className="text-xs mt-2 text-center">{t("coffeeReading.guideSaucer")}</Text>
                <Ionicons name="checkmark-circle" size={18} color={greenCheck} style={{ marginTop: 6 }} />
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
      )}

      {paywallOpen ? <PaywallScreen context="feature" onContinueFree={() => setPaywallOpen(false)} /> : null}
    </AuroraSafeArea>
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
    <AuroraSafeArea className="flex-1 px-6">
      <BackRow onBack={() => router.replace("/(main)/home")} />
<Text style={{ color: tc.textPrimary }} className="text-2xl font-bold mb-3">Future Guidance</Text>

      <View className="rounded-3xl border border-slate-700 p-4 mb-4">
<Text style={{ color: tc.textSecondary }} className="text-sm uppercase tracking-wide mb-2">Domain</Text>
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
              className="px-3 py-2 rounded-full border"
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
            <View className="mb-3 rounded-3xl border border-indigo-800 p-4 bg-slate-950">
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
    </AuroraSafeArea>
  );
}

export default function FeaturePlaceholderScreen() {
  const { id, prefill } = useLocalSearchParams<FeatureParams>();
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const router = useRouter();

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
    return <TarotInterpreterFeature />;
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
    <AuroraSafeArea className="flex-1">
      <View className="flex-1 items-center justify-center px-6">
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
    </AuroraSafeArea>
  );
}
