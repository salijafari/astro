import { Ionicons } from "@expo/vector-icons";
import { forwardRef } from "react";
import type { Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
} from "react-native";
import type { AppTheme } from "@/constants/theme";
import {
  CHAT_COMPOSER_MAX_INPUT_HEIGHT,
  CHAT_COMPOSER_MIN_HEIGHT,
  CHAT_SEND_BUTTON_SIZE,
  CHAT_SEND_ICON_SIZE,
} from "@/constants/chatLayout";

export type ChatComposerBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder: string;
  theme: AppTheme;
  rtl: boolean;
  /** Horizontal gutter in px (use `useChatScreenHorizontalPadding()`). */
  horizontalPadding: number;
  /** Disables the text field (e.g. while streaming). */
  inputDisabled?: boolean;
  /** When true, send is dimmed and non-pressable if `value` is blank. */
  inactiveSendUnlessText?: boolean;
  /** Replaces send icon with a spinner. */
  sending?: boolean;
  maxLength?: number;
  /** Appended to outer row className (e.g. web `chat-input-bar`). */
  outerClassName?: string;
};

/**
 * Shared chat composer: filled input + circular send, consistent padding and radii across chat screens.
 */
export const ChatComposerBar = forwardRef<TextInput, ChatComposerBarProps>(function ChatComposerBar(
  {
  value,
  onChangeText,
  onSend,
  placeholder,
  theme,
  rtl,
  horizontalPadding,
  inputDisabled = false,
  inactiveSendUnlessText = true,
  sending = false,
  maxLength,
  outerClassName = "",
  },
  ref: Ref<TextInput>,
) {
  const trimmed = value.trim();
  const sendPressDisabled =
    sending || inputDisabled || (inactiveSendUnlessText && !trimmed);

  const sendBg = sendPressDisabled
    ? theme.colors.surfaceVariant
    : theme.colors.primary;

  const iconColor = sendPressDisabled
    ? theme.colors.onSurfaceVariant
    : theme.colors.onPrimary;

  return (
    <View
      className={`flex-row items-end gap-2 border-t py-3${outerClassName ? ` ${outerClassName}` : ""}`}
      style={{
        borderTopColor: theme.colors.outlineVariant,
        paddingHorizontal: horizontalPadding,
      }}
    >
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.onSurfaceVariant}
        selectionColor={theme.colors.primary}
        cursorColor={theme.colors.primary}
        className="flex-1 rounded-xl px-3 py-2 text-base"
        style={{
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onBackground,
          minHeight: CHAT_COMPOSER_MIN_HEIGHT,
          maxHeight: CHAT_COMPOSER_MAX_INPUT_HEIGHT,
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
        }}
        multiline
        textAlignVertical="top"
        {...(maxLength != null ? { maxLength } : {})}
        editable={!inputDisabled}
        returnKeyType="send"
        onSubmitEditing={() => {
          if (!sendPressDisabled) onSend();
        }}
      />
      <Pressable
        onPress={() => void onSend()}
        disabled={sendPressDisabled}
        accessibilityRole="button"
        hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}
        style={{
          width: CHAT_SEND_BUTTON_SIZE,
          height: CHAT_SEND_BUTTON_SIZE,
          borderRadius: CHAT_SEND_BUTTON_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: sendBg,
        }}
      >
        {sending ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name="send" size={CHAT_SEND_ICON_SIZE} color={iconColor} />
        )}
      </Pressable>
    </View>
  );
});

ChatComposerBar.displayName = "ChatComposerBar";
