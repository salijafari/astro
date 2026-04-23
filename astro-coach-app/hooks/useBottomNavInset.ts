/**
 * Total bottom inset so content stays above the floating island capsule + home indicator.
 *
 * Includes: island layout height (`NAV_ISLAND_LAYOUT_HEIGHT`) + safe bottom + breathing room.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NAV_ISLAND_LAYOUT_HEIGHT } from "@/components/navigation/AkhtarTabBar";

const BREATHING_ROOM = 8;

export function useBottomNavInset(): number {
  const insets = useSafeAreaInsets();
  return NAV_ISLAND_LAYOUT_HEIGHT + Math.max(insets.bottom, 10) + BREATHING_ROOM;
}
