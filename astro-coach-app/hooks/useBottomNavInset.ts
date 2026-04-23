/**
 * Bottom spacing for content so it clears the floating island tab bar (overlay).
 *
 * - `useIslandOverlayBottomPadding`: extra pad when parent already applies bottom safe area.
 * - `useBottomNavInset`: full inset including safe bottom (scroll roots without bottom SafeArea).
 */
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ISLAND_BOTTOM_OFFSET,
} from "@/components/navigation/AkhtarTabBar";

const BREATHING_ROOM_PX = 8;

/** Routes where the main 4-tab island is visible (not hidden stacks like mantra/tarot/feature). */
export function useShowsFloatingMainIsland(): boolean {
  const segments = useSegments();
  const idx = segments.indexOf("(main)");
  if (idx === -1) return false;
  const rest = segments.slice(idx + 1);
  if (rest.length !== 1) return false;
  const top = rest[0];
  return top === "home" || top === "transits" || top === "chart" || top === "people";
}

/**
 * Padding to add above safe-area bottom so scroll/composer content clears the island overlay.
 * Use inside screens that already wrap with SafeAreaView bottom (AMA, features, mantra, tarot).
 */
export function useIslandOverlayBottomPadding(): number {
  const island = useShowsFloatingMainIsland();
  if (island) return ISLAND_BOTTOM_OFFSET + BREATHING_ROOM_PX;
  return BREATHING_ROOM_PX;
}

/**
 * Total bottom inset: island stack + safe area + breathing room.
 * Use for full-screen scroll roots that do not apply SafeAreaView bottom (e.g. Home).
 */
export function useBottomNavInset(): number {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 10);
  return useIslandOverlayBottomPadding() + safeBottom;
}
