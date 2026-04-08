import { useWindowDimensions } from "react-native";

/** Match dream interpreter desktop breakpoint for horizontal gutter. */
export const CHAT_LAYOUT_BREAKPOINT = 768;

/** Allowed spacing scale: 16 (mobile) / 20 (wide) horizontal gutter for chat screens. */
export function getChatScreenHorizontalPadding(width: number): number {
  return width >= CHAT_LAYOUT_BREAKPOINT ? 20 : 16;
}

/**
 * Responsive horizontal padding for chat and history layouts (16 mobile, 20 at width >= 768).
 */
export function useChatScreenHorizontalPadding(): number {
  const { width } = useWindowDimensions();
  return getChatScreenHorizontalPadding(width);
}

export const CHAT_COMPOSER_MIN_HEIGHT = 56;
export const CHAT_COMPOSER_MAX_INPUT_HEIGHT = 100;
export const CHAT_SEND_BUTTON_SIZE = 40;
export const CHAT_SEND_ICON_SIZE = 20;
export const CHAT_BUBBLE_MAX_WIDTH_PERCENT = 80;

/** iOS KeyboardAvoidingView offset when under a stack header (feature screens). */
export const CHAT_KAV_HEADER_OFFSET_IOS = 8;
