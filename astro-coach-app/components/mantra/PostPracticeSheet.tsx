import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import { saveMantraToJournal } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BottomSheetModal } from "./BottomSheetModal";

export type PostPracticeSheetProps = {
  open: boolean;
  onClose: () => void;
  onDoneNavigate: () => void;
  summaryLine: string;
  modeId: string;
  repetitions: number;
};

export const PostPracticeSheet: FC<PostPracticeSheetProps> = ({
  open,
  onClose,
  onDoneNavigate,
  summaryLine,
  modeId,
  repetitions,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const { getToken } = useAuth();
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveMantraToJournal(getToken, {
        practiceMode: modeId,
        repetitionCount: repetitions,
        userNote: note.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => {
        onClose();
        onDoneNavigate();
      }, 1000);
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="44%">
      <View className="px-4 pb-8">
        <Text
          className="mb-1 text-lg font-bold text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.practiceComplete")}
        </Text>
        <Text className="mb-4 text-sm text-white/50">{summaryLine}</Text>
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
          onPress={() => void save()}
          disabled={busy || saved}
          className="mb-2 items-center rounded-xl bg-violet-600 py-3"
        >
          <Text className="font-semibold text-white">
            {saved ? t("mantra.saved") : t("mantra.saveToJournal")}
          </Text>
        </Pressable>
        <Pressable onPress={onDoneNavigate} className="items-center py-2">
          <Text className="text-white/50">{t("mantra.done")}</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
};
