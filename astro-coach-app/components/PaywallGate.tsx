import { useEffect, type FC } from "react";
import { usePaywall } from "@/lib/usePaywall";

type Props = {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
};

/**
 * When opened, navigates to the unified paywall screen. Keeps the same props as the old modal gate.
 */
export const PaywallGate: FC<Props> = ({ visible, onClose, featureName: _featureName }) => {
  const { showPaywall } = usePaywall();

  useEffect(() => {
    if (!visible) return;
    showPaywall();
    onClose();
  }, [visible, showPaywall, onClose]);

  return null;
};
