import type { Locales } from '@packages/database/index';

import { supabase } from '~/lib/supabase';

type PushTokenRegistration = {
  expoPushToken: string;
  locale: Locales;
  profileId: string | undefined;
};

export type PushTokenRegistrationResult = 'inserted' | 'skipped' | 'updated';

/**
 * Associates a device token only after the signed-in profile is available.
 * Existing tokens are never reassigned client-side because the current RLS
 * policy intentionally permits updates only by the owning profile.
 */
export async function registerPushTokenForProfile({
  expoPushToken,
  locale,
  profileId,
}: PushTokenRegistration): Promise<PushTokenRegistrationResult> {
  if (!expoPushToken || !profileId) return 'skipped';

  const { data: existingToken, error: selectError } = await supabase
    .from('push_tokens')
    .select('id, profile_id')
    .eq('token', expoPushToken)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Could not look up the push token: ${selectError.message}`);
  }

  if (existingToken) {
    if (existingToken.profile_id !== profileId) {
      throw new Error(
        'This push token is already associated with a different profile.',
      );
    }

    const { error: updateError } = await supabase
      .from('push_tokens')
      .update({
        language: locale,
        created_at: new Date().toISOString(),
      })
      .eq('id', existingToken.id);

    if (updateError) {
      throw new Error(
        `Could not update the push token: ${updateError.message}`,
      );
    }

    return 'updated';
  }

  const { error: insertError } = await supabase.from('push_tokens').insert({
    token: expoPushToken,
    profile_id: profileId,
    language: locale,
  });

  if (insertError) {
    throw new Error(
      `Could not register the push token: ${insertError.message}`,
    );
  }

  return 'inserted';
}
