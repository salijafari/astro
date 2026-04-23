/**
 * Shell-aware bottom layout insets for the main app.
 *
 * - Home indicator / safe bottom: always from device insets.
 * - Floating island reserve: only when the current tab route shows the tab bar
 *   (see `TAB_ROUTES_WITH_VISIBLE_FLOATING_ISLAND`), derived from `useRoute().name`,
 *   not URL segment shape.
 */
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_ROUTES_WITH_VISIBLE_FLOATING_ISLAND } from "@/constants/mainTabShell";
import { ISLAND_BOTTOM_OFFSET } from "@/components/navigation/AkhtarTabBar";

/** Small gap between scroll/content end and the next chrome (not a second “island”). */
export const SCROLL_BOTTOM_BREATHING_ROOM_PX = 8;

/**
 * True when the floating island tab bar is actually on screen for this route.
 * Uses the focused tab screen `route.name` from React Navigation.
 */
export function useFloatingIslandVisible(): boolean {
  const route = useRoute();
  return TAB_ROUTES_WITH_VISIBLE_FLOATING_ISLAND.has(route.name);
}

/**
 * Bottom safe-area / home-indicator inset with a reasonable floor (matches prior behavior).
 */
export function useHomeIndicatorInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 10);
}

/**
 * Full-screen / hidden-tab scroll roots that omit bottom `SafeAreaView` on the shell:
 * home indicator + breathing only (no floating island reserve).
 */
export function useHiddenTabScrollBottomInset(): number {
  return useHomeIndicatorInset() + SCROLL_BOTTOM_BREATHING_ROOM_PX;
}

/**
 * Vertical space for the island pill + breathing room. Zero when the tab bar is hidden.
 */
export function useFloatingIslandReserve(): number {
  return useFloatingIslandVisible()
    ? ISLAND_BOTTOM_OFFSET + SCROLL_BOTTOM_BREATHING_ROOM_PX
    : 0;
}

/**
 * Primary-tab scroll areas whose parent does not apply bottom safe area to the scroll
 * region (e.g. Home, Chart, People, Personal transits): island (when visible) + breath + home indicator.
 */
export function usePrimaryTabScrollBottomInset(): number {
  return useFloatingIslandReserve() + useHomeIndicatorInset();
}

/**
 * Extra bottom padding when the parent already applies bottom safe area (e.g. `SafeAreaView`
 * `edges` includes `bottom`): add island stack + breath if the island is visible, else
 * only `SCROLL_BOTTOM_BREATHING_ROOM_PX`.
 */
export function useFloatingIslandExtraPadding(): number {
  return useFloatingIslandVisible()
    ? ISLAND_BOTTOM_OFFSET + SCROLL_BOTTOM_BREATHING_ROOM_PX
    : SCROLL_BOTTOM_BREATHING_ROOM_PX;
}
