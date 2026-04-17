import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import { getMantraToday, pinMantra, postMantraPractice } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { trackEvent } from "@/lib/mixpanel";
import { useFeatureAccess } from "@/lib/useFeatureAccess";
import { useMantraStore } from "@/stores/mantraStore";
import type { MantraData, MantraRegister, PracticeModeId } from "@/types/mantra";
import { BottomSheetModal } from "./BottomSheetModal";

export type PostPracticeSheetProps = {
  open: boolean;
  onClose: () => void;
  onDoneNavigate: () => void;
  summaryLine: string;
  modeId: PracticeModeId;
  repetitions: number;
  durationSec: number;
  register: MantraRegister;
  language: "en" | "fa";
  mantraText: string;
  mantra: MantraData;
};

/**
 * After practice: save `UserMantraPractice`, optional note, pin (premium), or exit without saving.
 */
export const PostPracticeSheet: FC<PostPracticeSheetProps> = ({
  open,
  onClose,
  onDoneNavigate,
  summaryLine,
  modeId,
  repetitions,
  durationSec,
  register,
  language,
  mantraText,
  mantra,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const { getToken } = useAuth();
  const { requireAccess } = useFeatureAccess();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const safeDuration = Math.min(3600, Math.max(3, durationSec));

  const saveJournal = async () => {
    setBusy(true);
    try {
      await postMantraPractice(getToken, {
        templateId: mantra.templateId,
        mantraText,
        language,
        register,
        practiceMode: modeId,
        durationSec: safeDuration,
        journalNote: note.trim() || undefined,
        qualityTag: mantra.qualityTag,
        qualityLabelEn: mantra.qualityLabelEn,
        qualityLabelFa: mantra.qualityLabelFa,
      });
      setSaved(true);
      trackEvent("mantra_practice_journal_saved", { mode: modeId });
      setTimeout(() => {
        onClose();
        onDoneNavigate();
      }, 900);
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  const onPinPress = () => {
    requireAccess(() => {
      void (async () => {
        setPinBusy(true);
        try {
          const res = await pinMantra(getToken);
          const fresh = await getMantraToday(getToken);
          useMantraStore.getState().setMantra({
            ...fresh,
            isPinned: true,
            pinExpiresAt: res.expiresAt,
          });
          trackEvent("mantra_pinned_post_practice");
        } catch {
          /* noop */
        } finally {
          setPinBusy(false);
        }
      })();
    }, "Mantra Pin");
  };

  const doneWithoutSave = () => {
    trackEvent("mantra_post_practice_done_no_save", { mode: modeId });
    onClose();
    onDoneNavigate();
  };

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="70%">
      <View className="max-h-[85%] px-4 pb-8">
        <Text
          className="mb-1 text-lg font-bold text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.practiceComplete")}
        </Text>
        <Text
          className="mb-2 text-sm text-white/50"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {summaryLine}
          {repetitions > 0 ? ` · ${repetitions}` : ""}
        </Text>

        <View className="mb-4 rounded-xl border border-white/15 bg-white/5 px-3 py-3">
          <Text
            className="text-center text-base font-semibold leading-6 text-white"
            style={{ writingDirection: isRtl ? "rtl" : "ltr" }}
            numberOfLines={4}
          >
            “{mantraText}”
          </Text>
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t("mantra.postNotePlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          className="mb-3 min-h-[80px] rounded-xl border border-white/20 px-3 py-2 text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        />

        <Pressable
          onPress={() => void saveJournal()}
          disabled={busy || saved}
          className="mb-2 min-h-[44px] items-center justify-center rounded-xl bg-violet-600 py-3"
        >
          <Text className="font-semibold text-white">{saved ? t("mantra.saved") : t("mantra.savePracticeJournal")}</Text>
        </Pressable>

        <Pressable
          onPress={() => onPinPress()}
          disabled={pinBusy || mantra.isPinned}
          className="mb-2 min-h-[44px] items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/15 py-3"
        >
          <Text className="font-semibold text-amber-100">
            {mantra.isPinned ? t("mantra.alreadyPinned") : t("mantra.pinSevenDays")}
          </Text>
        </Pressable>

        <Pressable onPress={doneWithoutSave} className="min-h-[44px] items-center py-2">
          <Text className="text-white/50">{t("mantra.doneWithoutSaving")}</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
};
