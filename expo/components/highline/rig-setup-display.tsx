import {
  getRigSetupDays,
  type RiggerProfile,
  type RigStatuses,
  type Setup,
} from '@chooselife/ui';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { getR2PublicUrl } from '~/lib/r2';
import { cn } from '~/lib/utils';

import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Text } from '~/components/ui/text';

export type RigSetup = Setup[number];
export type SetupWebbing = RigSetup['rig_setup_webbing'][number];
export type RiggerProfiles = Map<string, RiggerProfile> | undefined;

export const MAIN_WEBBING_COLOR = '#FE5577';
export const BACKUP_WEBBING_COLOR = '#3b82f6';

/** Main and backup sections in the order they were saved, with totals. */
export function splitWebbing(setup: RigSetup) {
  const sorted = [...setup.rig_setup_webbing].sort((a, b) => a.id - b.id);
  const main = sorted.filter((w) => w.webbing_type === 'main');
  const backup = sorted.filter((w) => w.webbing_type === 'backup');
  const sum = (list: SetupWebbing[]) =>
    list.reduce((total, w) => total + Number(w.length), 0);

  return {
    main,
    backup,
    mainTotal: sum(main),
    backupTotal: sum(backup),
    hasWebbing: sorted.length > 0,
  };
}

/** Plural-free count keys; the project has no `Intl.PluralRules` setup. */
function countKey(count: number) {
  if (count === 0) return 'zero' as const;
  if (count === 1) return 'one' as const;
  return 'many' as const;
}

function useDateFormatter() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  return useMemo(() => {
    const full = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const short = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
    });
    return {
      full: (date: Date) => full.format(date),
      short: (date: Date) => short.format(date),
    };
  }, [locale]);
}

/**
 * The day count is the headline and the date (or range) the secondary line.
 * An overdue plan already names its date in the headline, so it has no
 * secondary line.
 */
export function useSetupDays(setup: RigSetup) {
  const { t } = useTranslation();
  const format = useDateFormatter();
  const { status, days, overdue } = getRigSetupDays(setup);
  const rigDate = new Date(setup.rig_date);

  const label = overdue
    ? t('components.highline.history.days.planned.overdue', {
        date: format.full(rigDate),
      })
    : t(`components.highline.history.days.${status}.${countKey(days)}`, {
        count: days,
      });

  let dateText: string | null = overdue ? null : format.full(rigDate);
  if (status === 'unrigged' && setup.unrigged_at) {
    const unriggedAt = new Date(setup.unrigged_at);
    const sameYear = unriggedAt.getFullYear() === rigDate.getFullYear();
    const start = sameYear ? format.short(rigDate) : format.full(rigDate);
    dateText = `${start} – ${format.full(unriggedAt)}`;
  }

  return {
    status,
    label,
    dateText,
    statusLabel: t(`components.highline.history.status.${status}`),
  };
}

export function useRiggerCountLabel(count: number) {
  const { t } = useTranslation();
  if (count === 0) return t('components.highline.history.riggers.none');
  return t(`components.highline.history.riggers.${countKey(count)}`, {
    count,
  });
}

export function useWebbingLabels() {
  const { t } = useTranslation();
  const hasRegisteredName = (w: SetupWebbing) =>
    !!(w.webbing_id?.model?.name || w.webbing_id?.tag_name);

  return {
    // Unregistered webbing usually carries its name in `description`.
    name: (w: SetupWebbing) =>
      w.webbing_id?.model?.name ||
      w.webbing_id?.tag_name ||
      w.description ||
      t('components.highline.history.details.unregistered'),
    /** Description, unless `name` already used it. */
    note: (w: SetupWebbing) => (hasRegisteredName(w) ? w.description : null),
    loops: (w: SetupWebbing) => {
      const key =
        w.left_loop && w.right_loop
          ? 'both'
          : w.left_loop
            ? 'left'
            : w.right_loop
              ? 'right'
              : 'none';
      return t(`components.highline.history.details.loops.${key}`);
    },
  };
}

export const formatMeters = (meters: number) =>
  `${Number.isInteger(meters) ? meters : meters.toFixed(1)} m`;

/** Usernames are stored with or without a leading "@". */
export const formatUsername = (username: string) =>
  `@${username.replace(/^@/, '')}`;

export const STATUS_DOT: Record<RigStatuses, string> = {
  planned: 'bg-amber-400 border-amber-200',
  rigged: 'bg-green-500 border-green-200',
  unrigged: 'bg-muted border-muted-foreground',
};

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
