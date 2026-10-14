import { getTranslatedStatus, useWebbingUsage } from '@chooselife/ui';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import {
  CameraIcon,
  ChevronRightIcon,
  PackageIcon,
  XIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import { useWebbingPhoto } from '~/hooks/use-webbing-photo';
import {
  getWebbingName,
  useUserWebbings,
  type WebbingWithUsage,
} from '~/hooks/use-webbings';
import { getR2PublicUrl } from '~/lib/r2';

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

function WebbingPhoto({ webbing }: { webbing: WebbingWithUsage }) {
  const { t } = useTranslation();
  const [isPicking, setIsPicking] = useState(false);
  const [failedUri, setFailedUri] = useState<string>();
  const mutation = useWebbingPhoto(webbing);
  const isOnline = useOnlineStatus();
  const imagePath = webbing.image_path ?? webbing.model?.image_url;
  const uri = imagePath ? getR2PublicUrl('webbings', imagePath) : undefined;
  const image = uri && uri !== failedUri ? uri : undefined;
  const busy = isPicking || mutation.isPending;
  const disabled = busy || !isOnline;
  const name = getWebbingName(webbing);

  const showError = () =>
    Alert.alert(
      t(`${translationKey}.photoErrorTitle`),
      t(`${translationKey}.photoError`),
    );
  const choose = async () => {
    if (disabled) return;
    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        exif: false,
      });
      if (!result.canceled && result.assets[0])
        await mutation.mutateAsync(result.assets[0]);
    } catch {
      showError();
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <View className="h-24 w-20 rounded-xl overflow-hidden bg-slate-100">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          `${translationKey}.${image ? 'changePhotoFor' : 'addPhotoFor'}`,
          { name },
        )}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={() => void choose()}
        className="flex-1 items-center justify-center gap-1"
      >
        {image ? (
          <Image
            source={{ uri: image }}
            onError={() => setFailedUri(image)}
            resizeMode={webbing.image_path ? 'cover' : 'contain'}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <>
            <Icon as={CameraIcon} size={22} className="text-slate-400" />
            <Text className="text-[11px] text-slate-500">
              {t(`${translationKey}.addPhoto`)}
            </Text>
          </>
        )}
        {image && !busy && (
          <View className="absolute bottom-1 right-1 rounded-full bg-white/90 p-1.5">
            <Icon as={CameraIcon} size={14} className="text-slate-800" />
          </View>
        )}
        {busy && (
          <View className="absolute inset-0 items-center justify-center bg-white/80">
            <ActivityIndicator />
          </View>
        )}
      </Pressable>
      {webbing.image_path && !busy && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${translationKey}.removePhotoFor`, { name })}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => mutation.mutate(null, { onError: showError })}
          className="absolute right-0 top-0 h-11 w-11 items-center justify-center"
        >
          <View className="rounded-full bg-white/90 p-1">
            <Icon as={XIcon} size={14} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

function WebbingPhotoRow({ webbing }: { webbing: WebbingWithUsage }) {
  const { t, i18n } = useTranslation();
  const lifetime = webbing.model?.recommended_lifetime_days;
  const strength = webbing.strength_class ?? webbing.model?.strength_class;
  const {
    data: usage,
    isPending: usagePending,
    isPlaceholderData: usagePlaceholder,
    isError: usageError,
  } = useWebbingUsage(webbing.id, lifetime ?? null);
  const loops = Number(webbing.left_loop) + Number(webbing.right_loop);
  const color =
    usage.status === 'replace'
      ? '#dc2626'
      : usage.status === 'inspect'
        ? '#b45309'
        : '#059669';
  const specs = [
    `${webbing.length} m`,
    webbing.model?.material,
    webbing.model?.weave,
    `${loops} ${t(loops === 1 ? 'common.loop' : 'common.loops')}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View className="rounded-2xl bg-white border border-slate-200 p-4 gap-4">
      <View className="flex-row gap-3">
        <WebbingPhoto webbing={webbing} />
        <Link asChild href={`/webbing/${webbing.id}`}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t(`${translationKey}.viewHistory`, {
              name: getWebbingName(webbing),
            })}
            className="flex-1 flex-row items-center gap-2 min-h-11"
          >
            <View className="flex-1 gap-1.5">
              <Text className="text-base font-semibold text-slate-900">
                {getWebbingName(webbing)}
              </Text>
              <Text className="text-xs text-slate-500">
                ID {webbing.id}
                {strength
                  ? ` · ${t(`${translationKey}.strength`, { strength })}`
                  : ''}
                {webbing.isUsed ? ` · ${t(`${translationKey}.riggedNow`)}` : ''}
              </Text>
              <Text className="text-xs leading-5 text-slate-500">{specs}</Text>
            </View>
            <Icon as={ChevronRightIcon} size={16} className="text-slate-400" />
          </Pressable>
        </Link>
      </View>
      {lifetime ? (
        usagePending || usagePlaceholder ? (
          <Skeleton className="h-4 w-full rounded" />
        ) : usageError ? (
          <Text className="text-xs text-muted-foreground">
            {t(`${translationKey}.usageError`)}
          </Text>
        ) : (
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
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.max(0, Math.min(100, usage.percentageUsed)),
              }}
              className="h-1 rounded-full bg-slate-100 overflow-hidden"
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, usage.percentageUsed))}%`,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}
