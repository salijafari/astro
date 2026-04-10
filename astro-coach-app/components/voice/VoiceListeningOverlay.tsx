/**
 * Full-screen overlay when voice phase is "listening".
 * Large stop control and short instructions (i18n).
 */
import type { FC } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AppTheme } from "@/constants/theme";

interface VoiceListeningOverlayProps {
  visible: boolean;
  theme: AppTheme;
  rtl: boolean;
  onStop: () => void;
  onCancel: () => void;
}

export const VoiceListeningOverlay: FC<VoiceListeningOverlayProps> = ({
  visible,
  theme,
  rtl,
  onStop,
  onCancel,
}) => {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <View style={[styles.ring, { borderColor: theme.colors.primary }]} />

      <View style={[styles.orb, { backgroundColor: theme.colors.primaryContainer }]}>
        <Ionicons name="mic" size={40} color={theme.colors.primary} />
      </View>

      <Text
        style={[
          styles.instruction,
          {
            color: theme.colors.onBackground,
            textAlign: "center",
            writingDirection: rtl ? "rtl" : "ltr",
          },
        ]}
      >
        {t("voice.speakNow")}
      </Text>
      <Text
        style={[
          styles.subInstruction,
          {
            color: theme.colors.onSurfaceVariant,
            textAlign: "center",
            writingDirection: rtl ? "rtl" : "ltr",
          },
        ]}
      >
        {t("voice.pressDoneWhenFinished")}
      </Text>

      <Pressable
        onPress={onStop}
        style={[styles.stopBtn, { backgroundColor: theme.colors.primary }]}
        accessibilityRole="button"
      >
        <Ionicons name="stop" size={32} color={theme.colors.onPrimary} />
      </Pressable>

      <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button">
        <Text style={[styles.cancelText, { color: theme.colors.onSurfaceVariant }]}>
          {t("common.cancel")}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,8,15,0.88)",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    zIndex: 999,
  },
  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    opacity: 0.4,
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  instruction: {
    fontSize: 20,
    fontWeight: "600",
    maxWidth: 280,
  },
  subInstruction: {
    fontSize: 14,
    maxWidth: 260,
    marginTop: -8,
  },
  stopBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
  },
});
