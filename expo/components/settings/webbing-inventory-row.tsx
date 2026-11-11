import {
  getTranslatedStatus,
  useWebbingUsage,
  type WebbingLifetimeStatus,
} from '@chooselife/ui';
import { photoProgress, type LocalPhoto } from '~/features/photos/photo-file';
import type {
  InventoryEntry,
  InventoryGroupSubject,
  StrengthClaim,
} from '~/features/webbing/inventory';
import { Link } from 'expo-router';
import { ChevronRightIcon } from 'lucide-react-native';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useOnlineStatus } from '~/context/react-query';
import { useWebbingPhoto } from '~/hooks/use-webbing-photo';
import { getWebbingName, type WebbingWithUsage } from '~/hooks/use-webbings';
import { getR2PublicUrl } from '~/lib/r2';
import { cn } from '~/lib/utils';

import {
  photoErrorMessage,
  PhotoTile,
  usePhotoTransfer,
} from '~/components/photo-picker';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const translationKey = 'components.settings.my-webbing';

const STATUS_COLORS: Record<WebbingLifetimeStatus, string> = {
  good: '#059669',
  unknown: '#059669',
  inspect: '#b45309',
  replace: '#dc2626',
};

type Detail = { text: string; className?: string; color?: string };
// Nested `Text` resets to the base size, so each span restates it.
const DETAIL_TEXT = 'text-xs leading-4 text-slate-500';

/**
 * One physical webbing, led by its ID. The whole row opens its history; the
 * photo tile on top of it is a separate button for the personal photo.
 */
export function WebbingInventoryRow({
  entry,
  subject,
  claims,
  fallbackUri,
  hidden,
  first,
  last,
}: {
  entry: InventoryEntry<WebbingWithUsage>;
  /** The group the row sits in, so it does not repeat the heading. */
  subject: InventoryGroupSubject;
  claims: StrengthClaim[];
  /** The model photo, unless the group heading already shows it. */
  fallbackUri?: string;
  /** Collapsed or filtered out: kept mounted so a photo save keeps its state. */
  hidden: boolean;
  first: boolean;
  last: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { webbing, specs, customName } = entry;
  const lifetime = specs.recommendedLifetimeDays;
  const { data: usage, isError: usageError } = useWebbingUsage(
    webbing.id,
    lifetime,
  );
  const model = useModelLabel(entry, subject);
  const idLabel = `ID ${webbing.id}`;
  const length = `${webbing.length.toLocaleString(i18n.language)} m`;
  const photo = useWebbingPhotoTile(
    webbing,
    `${idLabel} · ${getWebbingName(webbing)}`,
    fallbackUri,
  );
  const percentUsed =
    lifetime && usage?.percentageUsed != null
      ? Math.max(0, Math.min(100, usage.percentageUsed))
      : null;

  const details: Detail[] = [];
  if (customName)
    details.push({ text: customName, className: 'text-slate-700' });
  for (const { strength, claim } of claims)
    details.push({
      text: t(
        `${translationKey}.${claim === 'model' ? 'strength' : 'personalStrength'}`,
        { strength },
      ),
      // An owner's class next to a different model class is a conflict.
      className:
        claim === 'personal' && specs.modelStrengthClass
          ? 'text-amber-700'
          : undefined,
    });
  if (webbing.isUsed)
    details.push({
      text: t(`${translationKey}.riggedNow`),
      className: 'text-emerald-700',
    });
  if (usageError) details.push({ text: t(`${translationKey}.usageError`) });
  else if (usage && percentUsed !== null)
    details.push(
      {
        text: t(`${translationKey}.daysUsed`, {
          used: usage.usageDays,
          total: lifetime,
        }),
      },
      {
        text: getTranslatedStatus(usage.status, i18n.language),
        className: 'font-semibold',
        color: STATUS_COLORS[usage.status],
      },
    );
  else if (usage)
    details.push(
      { text: t(`${translationKey}.usedDays`, { count: usage.usageDays }) },
      { text: t(`${translationKey}.rigs`, { count: usage.rigCount }) },
    );

  return (
    <View
      className={cn(
        'border-x border-slate-200 bg-white',
        first && 'rounded-t-2xl border-t',
        last && 'rounded-b-2xl border-b',
        hidden && 'hidden',
      )}
    >
      {!first ? <View className="ml-[68px] h-px bg-slate-100" /> : null}
      <View className="flex-row items-center gap-3 py-2.5 pl-3 pr-2">
        <Link asChild href={`/webbing/${webbing.id}`}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={[
              idLabel,
              length,
              model?.text,
              ...details.map((d) => d.text),
            ]
              .filter(Boolean)
              .join(', ')}
            accessibilityHint={t(`${translationKey}.viewHistoryHint`)}
            style={StyleSheet.absoluteFill}
            className={cn(
              'active:bg-slate-50',
              first && 'rounded-t-2xl',
              last && 'rounded-b-2xl',
            )}
          />
        </Link>
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          className="flex-1 min-w-0 flex-row items-center gap-3"
        >
          <IdBadge id={webbing.id} />
          <View className="flex-1 min-w-0 gap-0.5">
            <Text className="text-[15px] leading-5 text-slate-900">
              <Text className="text-[15px] font-semibold text-slate-900">
                {length}
              </Text>
              {model ? (
                <Text
                  className={cn(
                    'text-[15px] text-slate-600',
                    model.muted && 'text-slate-400',
                  )}
                >
                  {' · '}
                  {model.text}
                </Text>
              ) : null}
            </Text>
            {details.length ? (
              <Text className={DETAIL_TEXT}>
                {details.map((detail, index) => (
                  <Fragment key={index}>
                    {index ? ' · ' : null}
                    <Text
                      className={cn(DETAIL_TEXT, detail.className)}
                      style={detail.color ? { color: detail.color } : undefined}
                    >
                      {detail.text}
                    </Text>
                  </Fragment>
                ))}
              </Text>
            ) : null}
            {percentUsed !== null && usage ? (
              <View className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${percentUsed}%`,
                    backgroundColor: STATUS_COLORS[usage.status],
                  }}
                />
              </View>
            ) : null}
          </View>
        </View>
        <PhotoTile {...photo.tile} compact />
        <View pointerEvents="none">
          <Icon as={ChevronRightIcon} size={16} className="text-slate-300" />
        </View>
      </View>
      {photo.error ? (
        <View className="flex-row flex-wrap items-center gap-x-3 pb-2.5 pl-[68px] pr-3">
          <Text className="text-xs text-destructive">{photo.error}</Text>
          {photo.keepPrevious ? (
            <Pressable
              accessibilityRole="button"
              onPress={photo.keepPrevious}
              className="min-h-11 justify-center"
            >
              <Text className="text-xs font-semibold text-primary">
                {t(`${translationKey}.keepPreviousPhoto`)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function IdBadge({ id }: { id: number }) {
  return (
    <View className="min-h-11 min-w-11 items-center justify-center rounded-[10px] bg-slate-900 px-1.5 py-1">
      <Text className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
        ID
      </Text>
      <Text
        className="text-base font-bold leading-5 text-white"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {id}
      </Text>
    </View>
  );
}

/** The model, unless the group heading already names it. */
function useModelLabel(
  { specs }: InventoryEntry<WebbingWithUsage>,
  subject: InventoryGroupSubject,
): { text: string; muted?: boolean } | null {
  const { t } = useTranslation();
  const headingNamesModel =
    subject.kind === 'model' ||
    (subject.kind === 'missing' &&
      (subject.field === 'model' || subject.field === 'unsupported-model'));
  if (headingNamesModel) return null;
  // The brand heading already says the brand.
  if (subject.kind === 'brand' && specs.catalog)
    return {
      text: [specs.catalog.name, specs.catalog.version]
        .filter(Boolean)
        .join(' '),
    };
  if (specs.modelName) return { text: specs.modelName };
  return {
    text: t(
      `${translationKey}.missing.${specs.source === 'unsupported' ? 'unsupported-model' : 'model'}`,
    ),
    muted: true,
  };
}

/**
 * The row's personal photo: saves as soon as one is picked or removed. While
 * saving, and after a failed upload, the tile shows the picked photo.
 */
function useWebbingPhotoTile(
  webbing: WebbingWithUsage,
  name: string,
  fallbackUri?: string,
) {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const mutation = useWebbingPhoto(webbing);
  const photo = usePhotoTransfer();
  const change = mutation.variables;
  const showsChange =
    !!change &&
    (mutation.isPending ||
      mutation.isSuccess ||
      (mutation.isError && !!change.asset));
  const value = showsChange
    ? change.asset
    : webbing.image_path
      ? { uri: getR2PublicUrl('webbings', webbing.image_path) }
      : null;

  const save = (asset: LocalPhoto | null) => {
    if (asset) photo.report(photoProgress('preparing'));
    else photo.reset();
    mutation.mutate(
      { asset, onProgress: asset ? photo.report : undefined },
      {
        onSuccess: () => {
          if (asset) photo.succeed();
        },
        onError: (error) => {
          if (asset) photo.fail(photoErrorMessage(t, error));
        },
      },
    );
  };

  return {
    tile: {
      value,
      // Model photos are display-only fallbacks, never saved as personal photos.
      fallbackUri,
      onChange: save,
      transfer: photo.transfer,
      onRetry: isOnline && change?.asset ? () => save(change.asset) : undefined,
      disabled: !isOnline,
      name,
    },
    error: mutation.isError ? photoErrorMessage(t, mutation.error) : null,
    /** After a failed upload, go back to the stored photo. */
    keepPrevious:
      mutation.isError && change?.asset
        ? () => {
            mutation.reset();
            photo.reset();
          }
        : undefined,
  };
}
