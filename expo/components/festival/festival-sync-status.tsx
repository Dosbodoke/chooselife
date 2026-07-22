import { ClockIcon, RefreshCwIcon, WifiOffIcon } from '~/lib/icons/hugeicons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useI18n } from '~/context/i18n';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export function FestivalSyncStatus({
  isFetching,
  isOffline,
  timeZone,
  updatedAt,
}: {
  isFetching: boolean;
  isOffline: boolean;
  timeZone: string;
  updatedAt: number;
}) {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const hasSynced = updatedAt > 0;
  const updatedAtLabel = React.useMemo(() => {
    if (!hasSynced) {
      return null;
    }

    const parts = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
    })
      .formatToParts(new Date(updatedAt))
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});

    if (locale === 'pt') {
      return `${parts.day}/${parts.month}, ${parts.hour}:${parts.minute}h`;
    }

    return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}h`;
  }, [hasSynced, locale, timeZone, updatedAt]);
  const icon = isFetching ? RefreshCwIcon : isOffline ? WifiOffIcon : ClockIcon;
  const toneClassName = isOffline ? 'text-amber-700' : 'text-slate-500';
  const bgClassName = isOffline ? 'bg-amber-50' : 'bg-white';
  const borderClassName = isOffline ? 'border-amber-200' : 'border-slate-200';
  const label = isFetching
    ? t('app.(festival).highlines.syncChecking')
    : updatedAtLabel
      ? t(
          isOffline
            ? 'app.(festival).highlines.syncOfflineLastUpdated'
            : 'app.(festival).highlines.syncLastUpdated',
          {
            dateTime: updatedAtLabel,
          },
        )
      : t('app.(festival).highlines.syncNeverUpdated');

  return (
    <View
      className={`mx-4 flex-row items-center gap-2 rounded-full border px-3 py-2 ${bgClassName} ${borderClassName}`}
    >
      <Icon as={icon} className={`size-3.5 ${toneClassName}`} />
      <Text className={`flex-1 text-xs font-semibold ${toneClassName}`}>
        {label}
      </Text>
    </View>
  );
}
