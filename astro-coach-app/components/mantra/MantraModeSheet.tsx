import { type FC } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { isPersian } from "@/lib/i18n";
import type { MantraRegister } from "@/types/mantra";
import { BottomSheetModal } from "./BottomSheetModal";

export type MantraModeSheetProps = {
  open: boolean;
  onClose: () => void;
  value: MantraRegister;
  onChange: (v: MantraRegister) => void;
};

/**
 * Direct vs Exploratory register picker. RTL: Exploratory on the right, Direct on the left.
 */
export const MantraModeSheet: FC<MantraModeSheetProps> = ({ open, onClose, value, onChange }) => {
  const { t, i18n } = useTranslation();
  const isRtl = isPersian(i18n.language);
  /** Under RTL layout, child order maps to screen start/end so Direct stays visually left, Exploratory right. */
  const columnOrder: MantraRegister[] = isRtl ? ["exploratory", "direct"] : ["direct", "exploratory"];

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="40%">
      <View className="px-4 pb-8">
        <Text
          className="mb-4 text-lg font-semibold text-white"
          style={{ textAlign: isRtl ? "right" : "left", writingDirection: isRtl ? "rtl" : "ltr" }}
        >
          {t("mantra.registerSheetTitle")}
        </Text>
        <View className="flex-row gap-3">
          {columnOrder.map((id) => (
            <Pressable
              key={id}
              onPress={() => onChange(id)}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border px-3 py-3 ${
                value === id ? "border-violet-400 bg-violet-600/40" : "border-white/15 bg-white/5"
              }`}
            >
              <Text className="text-center font-semibold text-white">
                {id === "direct" ? t("mantra.registerDirect") : t("mantra.registerExploratory")}
              </Text>
              <Text
                className="mt-1 text-center text-xs text-white/60"
                style={{ writingDirection: isRtl ? "rtl" : "ltr" }}
              >
                {id === "direct" ? t("mantra.registerDirectFa") : t("mantra.registerExploratoryFa")}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheetModal>
  );
};
