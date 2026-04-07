import { useEffect, type FC } from "react";
import { usePaywall } from "@/lib/usePaywall";

type PaywallContext = "onboarding" | "chat_limit" | "compatibility" | "feature";

type Props = {
  context: PaywallContext;
  sunSign?: string;
  onContinueFree: () => void;
  onSubscribed?: () => void;
};

/**
 * Navigates to the unified paywall route and clears the parent overlay state via onContinueFree.
 */
export const PaywallScreen: FC<Props> = ({
  context: _context,
  sunSign: _sunSign,
  onContinueFree,
  onSubscribed: _onSubscribed,
}) => {
  const { showPaywall } = usePaywall();

  useEffect(() => {
    showPaywall();
    onContinueFree();
  }, [showPaywall, onContinueFree]);

  return null;
};
