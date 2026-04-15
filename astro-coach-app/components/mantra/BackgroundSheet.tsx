import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BottomSheetModal } from "./BottomSheetModal";
import { MANTRA_BACKGROUNDS } from "@/data/mantraBackgrounds";

type Props = {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelectBackground: (id: string | null) => Promise<void>;
};

export function BackgroundSheet({ open, onClose, selectedId, onSelectBackground }: Props) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("fa");
  const { width: W } = useWindowDimensions();

  const thumbW = W > 600 ? 130 : 110;
  const thumbH = Math.round(thumbW / 0.65);

  const handleSelect = async (id: string) => {
    await onSelectBackground(id);
    onClose();
  };

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="38%">
      <View style={{ paddingTop: 8, paddingBottom: 24 }}>
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "700",
            paddingHorizontal: 20,
            marginBottom: 16,
            textAlign: isRtl ? "right" : "left",
            writingDirection: isRtl ? "rtl" : "ltr",
          }}
        >
          {isRtl ? "پس‌زمینه" : "Background"}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 10,
          }}
        >
          {MANTRA_BACKGROUNDS.map((bg) => {
            const isSelected =
              selectedId === bg.id || (selectedId === null && bg.id === "mountain-sky-03");
            const isCosmic = bg.id === "cosmic-default";

            return (
              <Pressable
                key={bg.id}
                onPress={() => void handleSelect(bg.id)}
                style={{
                  width: thumbW,
                  height: thumbH,
                  borderRadius: 12,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: isSelected ? "#ffffff" : "transparent",
                }}
              >
                {isCosmic ? (
                  <LinearGradient
                    colors={["#1a0a2e", "#2d1b4e", "#0f172a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="sparkles" size={28} color="rgba(155,127,224,0.9)" />
                  </LinearGradient>
                ) : (
                  <Image
                    source={{ uri: bg.uri }}
                    style={{ flex: 1 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={200}
                  />
                )}

                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    backgroundColor: "rgba(0,0,0,0.45)",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: "600",
                      textAlign: "center",
                    }}
                  >
                    {isRtl ? bg.labelFa : bg.labelEn}
                  </Text>
                </View>

                {isSelected ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: "rgba(255,255,255,0.9)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="checkmark" size={13} color="#000" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </BottomSheetModal>
  );
}
