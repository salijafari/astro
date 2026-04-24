import { FONT, FONT_SIZE, RADIUS, SPACE } from "@/constants";
import { useThemeColors } from "@/lib/themeColors";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type CityResult = {
  displayName: string;
  lat: number;
  lng: number;
  timezone: string;
};

export type CitySearchInputProps = {
  value: string;
  onSelect: (city: { displayName: string; lat: number; lng: number; timezone: string }) => void;
  onClear: () => void;
  getToken: () => Promise<string | null>;
  placeholder?: string;
  theme: ReturnType<typeof useThemeColors>;
  rtl?: boolean;
};

const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

function createStyles(theme: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: RADIUS.lg,
      borderWidth: 0.5,
      borderColor: theme.border,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      paddingHorizontal: SPACE[3],
      minHeight: 48,
    },
    input: {
      flex: 1,
      fontFamily: FONT.sans,
      fontSize: FONT_SIZE.body,
      color: theme.textPrimary,
      paddingVertical: SPACE[3],
    },
    dropdown: {
      marginTop: 4,
      borderRadius: RADIUS.lg,
      borderWidth: 0.5,
      borderColor: theme.border,
      backgroundColor: theme.isDark ? "rgba(20,18,50,0.98)" : "rgba(255,255,255,0.98)",
      overflow: "hidden",
      zIndex: 100,
    },
    resultRow: {
      paddingHorizontal: SPACE[3],
      paddingVertical: SPACE[3],
    },
  });
}

export const CitySearchInput = ({
  value,
  onSelect,
  onClear,
  getToken,
  placeholder,
  theme,
  rtl,
}: CitySearchInputProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${apiBase}/api/geocode?q=${encodeURIComponent(text)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { results: CityResult[] };
          setResults(data.results ?? []);
          setShowDropdown(true);
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelect = (result: CityResult) => {
    setQuery(result.displayName);
    setShowDropdown(false);
    setResults([]);
    onSelect(result);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowDropdown(false);
    onClear();
  };

  return (
    <View style={{ position: "relative", zIndex: 100 }}>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder ?? "Search city..."}
          placeholderTextColor={theme.textTertiary}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          textAlign={rtl ? "right" : "left"}
        />
        {searching ? (
          <ActivityIndicator size="small" color={theme.textTertiary} style={{ marginEnd: SPACE[3] }} />
        ) : null}
        {query.length > 0 && !searching ? (
          <Pressable
            onPress={handleClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              marginEnd: SPACE[1],
            }}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 20, lineHeight: 24 }}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {showDropdown && results.length > 0 ? (
        <View style={styles.dropdown}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.displayName}-${r.lat}-${r.lng}-${i}`}
              onPress={() => handleSelect(r)}
              style={({ pressed }) => [
                styles.resultRow,
                pressed && { opacity: 0.7 },
                i < results.length - 1 && {
                  borderBottomWidth: 0.5,
                  borderBottomColor: theme.borderSubtle,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: FONT.sans,
                  fontSize: FONT_SIZE.body,
                  color: theme.textPrimary,
                  textAlign: rtl ? "right" : "left",
                }}
                numberOfLines={2}
              >
                {r.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};
