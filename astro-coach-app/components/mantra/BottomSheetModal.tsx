import { BlurView } from "expo-blur";
import { type FC, type ReactNode, useEffect } from "react";
import { Dimensions, Modal, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { height: SCREEN_H } = Dimensions.get("window");

function parseSnapHeight(snap: string): number {
  if (snap.endsWith("%")) {
    const n = parseFloat(snap.replace("%", ""));
    return (SCREEN_H * n) / 100;
  }
  const n = parseFloat(snap);
  return Number.isFinite(n) ? n : SCREEN_H * 0.5;
}

export type BottomSheetModalProps = {
  open: boolean;
  onClose: () => void;
  snapHeight: string;
  children: ReactNode;
};

/**
 * Modal bottom sheet with blur, dark scrim, slide-up animation (Reanimated).
 */
export const BottomSheetModal: FC<BottomSheetModalProps> = ({
  open,
  onClose,
  snapHeight,
  children,
}) => {
  const targetH = parseSnapHeight(snapHeight);
  const translateY = useSharedValue(targetH);

  useEffect(() => {
    translateY.value = withTiming(open ? 0 : targetH, { duration: 300 });
  }, [open, targetH, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={onClose}
        >
          <BlurView intensity={40} tint="dark" style={{ flex: 1 }} />
        </Pressable>
        <Animated.View
          style={[
            {
              maxHeight: targetH,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: "hidden",
              backgroundColor: "rgba(20,18,32,0.92)",
            },
            sheetStyle,
          ]}
        >
          <View className="items-center pt-2 pb-1">
            <View className="h-1 w-10 rounded-full bg-white/30" />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};
