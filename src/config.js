// Feature flags
export const DISABLE_CLIENT_NOTIFICATIONS = import.meta.env.VITE_DISABLE_CLIENT_NOTIFICATIONS === 'true';

// Check if a specific notification should be sent (master flag + granular preferences)
export function shouldSendNotification(notifType, channel, preferences) {
  // Master flag overrides everything
  if (DISABLE_CLIENT_NOTIFICATIONS) return false;

  // If no preferences loaded yet, default to false (all off by default)
  if (!preferences) return false;

  // Check granular preference
  return preferences?.[notifType]?.[channel] ?? false;
}