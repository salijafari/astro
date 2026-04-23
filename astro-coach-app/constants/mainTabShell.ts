/**
 * Tab route names where the bottom tab bar (floating island) is visible.
 *
 * Must match `app/(main)/_layout.tsx`: every `Tabs.Screen` that does **not**
 * set `tabBarStyle: { display: "none" }` should be listed here (currently the
 * four primary tabs only).
 */
export const TAB_ROUTES_WITH_VISIBLE_FLOATING_ISLAND = new Set<string>([
  "home",
  "transits",
  "chart",
  "people",
]);
