/**
 * Renders a dashboard feature icon from local SVG assets.
 * Metro (react-native-svg-transformer) turns each .svg into a
 * react-native-svg component; we render its default export.
 */
import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

type Props = {
  featureId: string;
  size: number;
};

const SVG_ASSETS: Record<string, FC<SvgProps>> = {
  "ask-anything": require("../../assets/icons/dashboard/ask-anything.svg").default,
  "tarot-interpreter": require("../../assets/icons/dashboard/tarot-interpreter.svg").default,
  "astrological-events": require("../../assets/icons/dashboard/astrological-events.svg").default,
  "romantic-compatibility": require("../../assets/icons/dashboard/romantic-compatibility.svg").default,
  "coffee-reading": require("../../assets/icons/dashboard/coffee-reading.svg").default,
  "dream-interpreter": require("../../assets/icons/dashboard/dream-interpreter.svg").default,
  "mantra": require("../../assets/icons/dashboard/mantra.svg").default,
};

export const DashboardSvgIcon = ({ featureId, size }: Props) => {
  const Svg = SVG_ASSETS[featureId];
  if (!Svg) return null;
  return <Svg width={size} height={size} />;
};
