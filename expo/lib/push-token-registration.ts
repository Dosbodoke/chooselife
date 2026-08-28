import type { Locales } from '@packages/database/index';

import { supabase } from '~/lib/supabase';

type PushTokenRegistration = {
  expoPushToken: string;
  locale: Locales;
  profileId: string | undefined;
};

export type PushTokenRegistrationResult = 'inserted' | 'skipped' | 'updated';

let activeExpoPushToken: string | null = null;

/**
 * Associates a device token through the authenticated database command. The
 * command atomically transfers ownership when a shared device changes
 * accounts, so the previous profile cannot keep receiving reminders.
 */
export async function registerPushTokenForProfile({
  expoPushToken,
  locale,
  profileId,
}: PushTokenRegistration): Promise<PushTokenRegistrationResult> {
  if (!expoPushToken || !profileId) return 'skipped';

  activeExpoPushToken = expoPushToken;
  const { data, error } = await supabase.rpc('register_push_token', {
    p_language: locale,
    p_token: expoPushToken,
  });

  if (error) {
    throw new Error(`Could not register the push token: ${error.message}`);
  }

  return data === 'registered' ? 'updated' : 'inserted';
}

export async function unregisterActivePushToken(): Promise<void> {
  if (!activeExpoPushToken) return;

  const token = activeExpoPushToken;
  const { error } = await supabase.rpc('unregister_push_token', {
    p_token: token,
  });

  if (error) {
    throw new Error(`Could not unregister the push token: ${error.message}`);
  }

  activeExpoPushToken = null;
}
