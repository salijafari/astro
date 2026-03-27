/**
 * Native stub — keyboard layout is handled by KeyboardAvoidingView on iOS/Android.
 * This file exists so Metro can resolve @/lib/keyboard on non-web platforms.
 */
export const setupKeyboardFix = (): (() => void) | undefined => undefined;
