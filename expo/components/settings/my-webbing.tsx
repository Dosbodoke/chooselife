import {
  getTranslatedStatus,
  resolveWebbingSpecs,
  useWebbingUsage,
  type ResolvedWebbingSpecs,
  type WebbingLifetimeStatus,
} from '@chooselife/ui';
import { photoProgress, type LocalPhoto } from '~/features/photos/photo-file';
import { Link } from 'expo-router';
import { ChevronRightIcon, PackageIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import { useWebbingPhoto } from '~/hooks/use-webbing-photo';
import {
  getWebbingName,
  useUserWebbings,
  type WebbingWithUsage,
} from '~/hooks/use-webbings';
import { getR2PublicUrl } from '~/lib/r2';

import {
  photoErrorMessage,
  PhotoTile,
  usePhotoTransfer,
} from '~/components/photo-picker';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

const translationKey = 'components.settings.my-webbing';

export function MyWebbings() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: webbings, isPending, isError, refetch } = useUserWebbings();

  if (!profile) {
    return (
      <View className="gap-4 p-4">
        <Text>{t(`${translationKey}.loginRequired`)}</Text>
        <Link asChild href="/(modals)/login">
          <Button>
            <Text>{t('app.(tabs).settings.logIn')}</Text>
          </Button>
        </Link>
      </View>
    );
  }

  return (
    <View className="gap-5">
      <View className="gap-1">
        {!isPending && !isError && (
          <Text className="text-base font-semibold">
            {t(`${translationKey}.count`, { count: webbings?.length ?? 0 })}
          </Text>
        )}
        <Text className="text-sm text-muted-foreground">
          {t(`${translationKey}.description`)}
        </Text>
      </View>
      {isPending ? (
        <View className="gap-3">
          {[0, 1, 2].map((id) => (
            <View key={id} className="flex-row gap-3 rounded-2xl bg-white p-4">
              <Skeleton className="h-24 w-20 rounded-xl" />
              <View className="flex-1 justify-center gap-3">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <View className="gap-4 rounded-2xl bg-white p-6">
          <Text>{t(`${translationKey}.loadError`)}</Text>
          <Button variant="outline" onPress={() => void refetch()}>
            <Text>{t(`${translationKey}.retry`)}</Text>
          </Button>
        </View>
      ) : !webbings?.length ? (
        <View className="items-center rounded-2xl bg-white px-6 py-10 gap-3">
          <Icon as={PackageIcon} size={32} className="text-muted-foreground" />
          <Text className="text-base font-semibold text-center">
            {t(`${translationKey}.empty`)}
          </Text>
          <Text className="text-sm text-center text-muted-foreground">
            {t(`${translationKey}.emptyDescription`)}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {webbings.map((webbing) => (
            <WebbingPhotoRow key={webbing.id} webbing={webbing} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * The row's photo: saves as soon as one is picked or removed. While saving,
 * and after a failed upload, the tile shows the picked photo, not the stored
 * one.
 */
function useWebbingPhotoTile(webbing: WebbingWithUsage) {
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
  const storedUri = webbing.image_path
    ? getR2PublicUrl('webbings', webbing.image_path)
    : null;
  const value = showsChange
    ? change.asset
    : storedUri
      ? { uri: storedUri }
      : null;
  // Personal photos only; saved SlackData snapshots never carry upstream images.
  const legacyImage = resolveWebbingSpecs(webbing).legacyImageUrl;

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
      fallbackUri: legacyImage
        ? getR2PublicUrl('webbings', legacyImage)
        : undefined,
      onChange: save,
      transfer: photo.transfer,
      onRetry: isOnline && change?.asset ? () => save(change.asset) : undefined,
      disabled: !isOnline,
      name: getWebbingName(webbing),
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

const STATUS_COLORS: Record<WebbingLifetimeStatus, string> = {
  good: '#059669',
  unknown: '#059669',
  inspect: '#b45309',
  replace: '#dc2626',
};

function WebbingPhotoRow({ webbing }: { webbing: WebbingWithUsage }) {
  const { t } = useTranslation();
  const specs = resolveWebbingSpecs(webbing);
  const photo = useWebbingPhotoTile(webbing);

  return (
    <View className="rounded-2xl bg-white border border-slate-200 p-4 gap-4">
      <View className="flex-row gap-3">
        <PhotoTile {...photo.tile} />
        <WebbingSummaryLink webbing={webbing} specs={specs} />
      </View>
      {photo.error ? (
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Text className="text-xs text-destructive">{photo.error}</Text>
          {photo.keepPrevious ? (
            <Pressable
              accessibilityRole="button"
              onPress={photo.keepPrevious}
              hitSlop={8}
            >
              <Text className="text-xs font-semibold text-primary">
                {t(`${translationKey}.keepPreviousPhoto`)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <WebbingLifetime
        webbingId={webbing.id}
        lifetime={specs.recommendedLifetimeDays}
      />
    </View>
  );
}

function WebbingSummaryLink({
  webbing,
  specs,
}: {
  webbing: WebbingWithUsage;
  specs: ResolvedWebbingSpecs;
}) {
  const { t } = useTranslation();
  const name = getWebbingName(webbing);
  const loops = Number(webbing.left_loop) + Number(webbing.right_loop);
  const modelStrength = specs.modelStrengthClass?.value;
  const strength = modelStrength
    ? t(`${translationKey}.strength`, { strength: modelStrength })
    : specs.personalStrengthClass
      ? t(`${translationKey}.personalStrength`, {
          strength: specs.personalStrengthClass,
        })
      : null;
  const details = [
    `ID ${webbing.id}`,
    strength,
    webbing.isUsed ? t(`${translationKey}.riggedNow`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const specLine = [
    `${webbing.length} m`,
    specs.materials?.join(' / '),
    specs.construction,
    `${loops} ${t(loops === 1 ? 'common.loop' : 'common.loops')}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link asChild href={`/webbing/${webbing.id}`}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t(`${translationKey}.viewHistory`, { name })}
        className="flex-1 flex-row items-center gap-2 min-h-11"
      >
        <View className="flex-1 gap-1.5">
          <Text className="text-base font-semibold text-slate-900">{name}</Text>
          <Text className="text-xs text-slate-500">{details}</Text>
          <Text className="text-xs leading-5 text-slate-500">{specLine}</Text>
        </View>
        <Icon as={ChevronRightIcon} size={16} className="text-slate-400" />
      </Pressable>
    </Link>
  );
}

function WebbingLifetime({
  webbingId,
  lifetime,
}: {
  webbingId: number;
  lifetime: number | null;
}) {
  const { t, i18n } = useTranslation();
  const { data: usage, isError } = useWebbingUsage(webbingId, lifetime);

  if (isError) {
    return (
      <Text className="text-xs text-muted-foreground">
        {t(`${translationKey}.usageError`)}
      </Text>
    );
  }
  if (!usage) return <Skeleton className="h-4 w-full rounded" />;
  if (!lifetime || usage.percentageUsed === null) {
    // No supported lifetime: show recorded use, no bar or remaining life.
    return (
      <Text className="text-xs text-slate-500">
        {t(`${translationKey}.usedDays`, { count: usage.usageDays })} ·{' '}
        {t(`${translationKey}.rigs`, { count: usage.rigCount })} ·{' '}
        {t(`${translationKey}.noLifetime`)}
      </Text>
    );
  }

  const color = STATUS_COLORS[usage.status];
  const percent = Math.max(0, Math.min(100, usage.percentageUsed));
  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between gap-2 flex-wrap">
        <Text className="text-xs text-slate-500">
          {t(`${translationKey}.daysUsed`, {
            used: usage.usageDays,
            total: lifetime,
          })}
        </Text>
        <Text className="text-xs font-semibold" style={{ color }}>
          {getTranslatedStatus(usage.status, i18n.language)}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('components.webbing-detail.lifetime.title')}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        className="h-1 rounded-full bg-slate-100 overflow-hidden"
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}
