/**
 * Bottom padding/inset so scroll content and composers clear the island tab bar.
 *
 * Uses island height + wrapper top padding + safe-area bottom + breathing room.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ISLAND_BOTTOM_OFFSET } from "@/components/navigation/AkhtarTabBar";

export function useBottomNavInset(): number {
  const insets = useSafeAreaInsets();
  return ISLAND_BOTTOM_OFFSET + Math.max(insets.bottom, 10) + 8;
}
