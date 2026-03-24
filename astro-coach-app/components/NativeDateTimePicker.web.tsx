import type { ReactNode } from "react";

type Props = Record<string, unknown>;

/**
 * Web screens use HTML date/time inputs; this stub avoids bundling @react-native-community/datetimepicker.
 */
export default function NativeDateTimePicker(_props: Props): ReactNode {
  return null;
}
