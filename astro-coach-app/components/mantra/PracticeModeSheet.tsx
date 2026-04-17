import { Ionicons } from "@expo/vector-icons";
import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSubscription } from "@/lib/useSubscription";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { PRACTICE_MODES, type MantraPracticeMode } from "@/types/mantra";
import { BottomSheetModal } from "./BottomSheetModal";

function isPremiumMode(mode: MantraPracticeMode): boolean {
  if (mode.id === "tap108") return true;
  if (mode.kind === "timer") return true;
  return false;
}

export type PracticeModeSheetProps = {
  open: boolean;
  onClose: () => void;
  onSelectMode: (mode: MantraPracticeMode) => void;
};

export const PracticeModeSheet: FC<PracticeModeSheetProps> = ({ open, onClose, onSelectMode }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const { hasAccess } = useSubscription();
  const { requireAccess } = useFeatureAccess();

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="52%">
      <View className="px-4 pb-8">
        <Text
          className="mb-4 text-lg font-semibold text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.choosePractice")}
        </Text>
        {PRACTICE_MODES.map((mode) => {
          const label = isRtl ? mode.labelFa : mode.labelEn;
          const locked = isPremiumMode(mode) && !hasAccess;
          return (
            <Pressable
              key={mode.id}
              onPress={() => {
                if (locked) {
                  requireAccess(() => onSelectMode(mode), "Mantra Practice");
                  return;
                }
                onSelectMode(mode);
              }}
              className="mb-2 flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <Text className="text-base text-white">{label}</Text>
              {locked ? <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.5)" /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheetModal>
  );
};
