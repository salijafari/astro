/** PURCHASES_ERROR_CODE.CONFIGURATION_ERROR */
const RC_CONFIGURATION_ERROR_CODE = "23";

/**
 * True when `error` is a RevenueCat billing/configuration issue we may ignore in development only.
 * Never true in production builds.
 */
export const isSilencedDevRevenueCatError = (error: unknown): boolean => {
  if (!__DEV__) return false;

  const readable = getReadableErrorCode(error);
  if (readable === "CONFIGURATION_ERROR" || readable === "ConfigurationError") return true;
  if (readable === "BILLING_UNAVAILABLE" || (readable != null && String(readable).includes("BILLING_UNAVAILABLE"))) {
    return true;
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === RC_CONFIGURATION_ERROR_CODE) return true;
  }

  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (
    msg.includes("BILLING_UNAVAILABLE") ||
    msg.includes("ConfigurationError") ||
    msg.includes("CONFIGURATION_ERROR")
  ) {
    return true;
  }

  return false;
};

function getReadableErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const o = error as { userInfo?: { readableErrorCode?: string }; readableErrorCode?: string };
  return o.userInfo?.readableErrorCode ?? o.readableErrorCode;
}
