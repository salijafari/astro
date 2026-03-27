/**
 * Fixes mobile browser keyboard layout shift on web PWA.
 *
 * Uses the Visual Viewport API to detect when the software keyboard opens and
 * writes two CSS custom properties that the rest of the app can use:
 *   --keyboard-visible-height  — the actual visible height above the keyboard
 *   --keyboard-offset          — the number of pixels the keyboard covers
 *
 * This runs only on web. Native platforms handle keyboard avoidance via
 * KeyboardAvoidingView. Called once from _layout.tsx on app start.
 */
export const setupKeyboardFix = (): (() => void) | undefined => {
  if (typeof window === "undefined") return;
  if (!window.visualViewport) return;

  const setViewportHeight = () => {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty("--keyboard-visible-height", `${vh}px`);
    document.documentElement.style.setProperty("--keyboard-offset", `${window.innerHeight - vh}px`);
  };

  window.visualViewport.addEventListener("resize", setViewportHeight);
  window.visualViewport.addEventListener("scroll", setViewportHeight);

  setViewportHeight();

  return () => {
    window.visualViewport?.removeEventListener("resize", setViewportHeight);
    window.visualViewport?.removeEventListener("scroll", setViewportHeight);
  };
};
