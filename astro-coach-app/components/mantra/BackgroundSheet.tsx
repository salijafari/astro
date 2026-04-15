import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View } from "react-native";
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

  const handleSelect = async (id: string | null) => {
    await onSelectBackground(id);
    onClose();
  };

  return (
    <BottomSheetModal open={open} onClose={onClose} snapHeight="65%">
      <View style={{ padding: 20 }}>
        {/* Title */}
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 16,
            textAlign: isRtl ? "right" : "left",
            writingDirection: isRtl ? "rtl" : "ltr",
          }}
        >
          {isRtl ? "پس‌زمینه" : "Background"}
        </Text>

        {/* Default option */}
        <Pressable
          onPress={() => void handleSelect(null)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 14,
            borderRadius: 12,
            marginBottom: 12,
            borderWidth: 2,
            borderColor: selectedId === null ? "#fff" : "rgba(255,255,255,0.15)",
            backgroundColor: "rgba(255,255,255,0.07)",
          }}
        >
          {/* Cosmic preview */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              backgroundColor: "#1E1A3C",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 14,
            }}
          >
            <Ionicons name="sparkles" size={22} color="#9B7FE0" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: "600",
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {isRtl ? "کیهانی (پیش‌فرض)" : "Cosmic (Default)"}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 12,
                marginTop: 2,
                textAlign: isRtl ? "right" : "left",
              }}
            >
              {isRtl ? "انیمیشن اورورا" : "Aurora animation"}
            </Text>
          </View>
          {selectedId === null ? <Ionicons name="checkmark-circle" size={22} color="#fff" /> : null}
        </Pressable>

        {/* Photo backgrounds grid */}
        {MANTRA_BACKGROUNDS.length === 0 ? (
          <View
            style={{
              padding: 24,
              alignItems: "center",
              opacity: 0.5,
            }}
          >
            <Ionicons name="image-outline" size={32} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {isRtl ? "تصاویر پس‌زمینه به زودی اضافه می‌شوند" : "Background photos coming soon"}
            </Text>
          </View>
        ) : (
          <FlatList
            data={MANTRA_BACKGROUNDS}
            numColumns={3}
            keyExtractor={(item) => item.id}
            columnWrapperStyle={{ gap: 8 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => void handleSelect(item.id)}
                style={{
                  flex: 1,
                  aspectRatio: 0.7,
                  borderRadius: 10,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: selectedId === item.id ? "#fff" : "transparent",
                }}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{ flex: 1 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
                {selectedId === item.id ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      borderRadius: 12,
                      padding: 2,
                    }}
                  >
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : null}
                <View
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 6,
                    backgroundColor: "rgba(0,0,0,0.4)",
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
                    {isRtl ? item.labelFa : item.labelEn}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </BottomSheetModal>
  );
}
