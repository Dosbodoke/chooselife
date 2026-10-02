import type { RiggerProfile, RigStatuses } from '@chooselife/ui';
import React from 'react';
import { View } from 'react-native';

import { getR2PublicUrl } from '~/lib/r2';
import { cn } from '~/lib/utils';

import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Text } from '~/components/ui/text';

import type { RiggerProfiles } from './rig-setup-utils';

const STATUS_PILL: Record<RigStatuses, { box: string; text: string }> = {
  planned: { box: 'bg-amber-100', text: 'text-amber-700' },
  rigged: { box: 'bg-green-100', text: 'text-green-700' },
  unrigged: { box: 'bg-muted', text: 'text-muted-foreground' },
};

export const StatusPill: React.FC<{ status: RigStatuses; label: string }> = ({
  status,
  label,
}) => (
  <View
    className={cn(
      'self-start rounded-full px-2.5 py-1',
      STATUS_PILL[status].box,
    )}
  >
    <Text className={cn('text-xs font-semibold', STATUS_PILL[status].text)}>
      {label}
    </Text>
  </View>
);

function riggerAvatarURL(profile?: RiggerProfile) {
  const picture = profile?.profile_picture;
  if (!picture) return undefined;
  // Google sign-in stores a full URL; uploads store an R2 key.
  if (/^https?:\/\//.test(picture)) return picture;
  return getR2PublicUrl('avatars', picture);
}

/** Overlapping avatars fed by the batched `useRiggerProfiles` query. */
export const RiggerAvatars: React.FC<{
  riggers: string[];
  profiles: RiggerProfiles;
  max?: number;
  size?: number;
}> = ({ riggers, profiles, max = 5, size = 36 }) => {
  const visible = riggers.slice(0, max);
  const extra = riggers.length - visible.length;

  return (
    <View className="flex-row">
      {visible.map((id, index) => (
        <View
          key={id}
          style={{ marginLeft: index === 0 ? 0 : -size / 4 }}
          className="rounded-full border-2 border-background"
        >
          <View
            style={{ width: size, height: size }}
            className="overflow-hidden rounded-full"
          >
            <SupabaseAvatar URL={riggerAvatarURL(profiles?.get(id))} />
          </View>
        </View>
      ))}
      {extra > 0 && (
        <View
          style={{ marginLeft: -size / 4, width: size + 4, height: size + 4 }}
          className="items-center justify-center rounded-full border-2 border-background bg-muted"
        >
          <Text className="text-xs font-bold text-muted-foreground">
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
};
