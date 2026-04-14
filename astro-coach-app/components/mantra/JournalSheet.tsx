import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";
import { saveMantraToJournal } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BottomSheetModal } from "./BottomSheetModal";

export type JournalSheetProps = {
  open: boolean;
  onClose: () => void;
};

export const JournalSheet: FC<JournalSheetProps> = ({ open, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const { getToken } = useAuth();
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    try {
      await saveMantraToJournal(getToken, {
        practiceMode: "journal_quick",
        repetitionCount: 0,
        userNote: note.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => {
        onClose();
        setSaved(false);
        setNote("");
      }, 1200);
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
          className="mb-2 text-lg font-semibold text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.journalSheetTitle")}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t("mantra.journalNotePlaceholder")}
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          className="mb-4 min-h-[100px] rounded-xl border border-white/20 px-3 py-2 text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        />
        {saved ? (
          <Text className="text-center text-green-300">{t("mantra.saved")}</Text>
        ) : (
          <Pressable
            onPress={() => void onSave()}
            disabled={busy}
            className="items-center rounded-xl bg-violet-600 py-3"
          >
            <Text className="font-semibold text-white">{t("mantra.saveJournal")}</Text>
          </Pressable>
        )}
      </View>
    </BottomSheetModal>
  );
};
