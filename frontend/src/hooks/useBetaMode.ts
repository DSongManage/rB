/**
 * Hook for determining beta mode and test mode status
 *
 * This hook checks environment variables to determine if the app is running in beta mode
 * and whether test mode features should be shown (e.g., Stripe test keys, devnet Solana).
 *
 * Usage:
 * ```tsx
 * const { isBeta, isTestMode, shouldShowBetaBadge } = useBetaMode();
 *
 * if (shouldShowBetaBadge) {
 *   return <BetaBadge variant="header" showTestMode={isTestMode} />;
 * }
 * ```
 */
export const useBetaMode = () => {
  // Check if environment is beta or development
  const environment = import.meta.env.VITE_ENVIRONMENT || 'development';
  const isBeta = environment === 'beta';
  const isDevelopment = environment === 'development';

  // Check if test mode is enabled
  const betaModeFlag = import.meta.env.VITE_BETA_MODE === 'true';
  const testModeFlag = import.meta.env.VITE_TEST_MODE === 'true';

  // Check if Solana is using devnet
  const solanaNetwork = import.meta.env.VITE_SOLANA_NETWORK || 'devnet';
  const isSolanaDevnet = solanaNetwork === 'devnet';

  // Overall test mode is true if any test indicator is present
  const isTestMode = testModeFlag || isSolanaDevnet;

  // Show beta badge if in beta mode OR if explicitly enabled
  const shouldShowBetaBadge = isBeta || betaModeFlag || isDevelopment;

  return {
    // Environment flags
    isBeta,
    isDevelopment,
    isProduction: environment === 'production',
    environment,

    // Test mode indicators
    isTestMode,
    isSolanaDevnet,

    // UI display flags
    shouldShowBetaBadge,
    shouldShowTestModeBanner: isTestMode,

    // Network info
    solanaNetwork,

    // Helper methods
    getEnvironmentLabel: () => {
      if (isBeta) return 'Beta';
      if (isDevelopment) return 'Development';
      return 'Production';
    },

    getNetworkLabel: () => {
      return isSolanaDevnet ? 'Devnet' : 'Mainnet';
    },
  };
};

export default useBetaMode;
