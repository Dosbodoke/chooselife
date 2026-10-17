import type { LocalPhoto } from '~/features/photos/photo-file';
import { PHOTO_SPECS, type PhotoSpec } from '~/features/photos/pick-photo';
import { Image } from 'expo-image';
import { ImagePlusIcon, XIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import { OPACITY_TRANSITION } from './motion';
import { TileStatus } from './transfer-status';
import { usePhotoActions } from './use-photo-actions';
import { isTransferring, type PhotoTransfer } from './use-photo-transfer';

const translationKey = 'components.photo-picker';

export interface PhotoTileProps {
  spec?: PhotoSpec;
  /** The personal photo, picked or stored. Only this one can be removed. */
  value: { uri: string } | null;
  /** Shown (contained) when there is no personal photo, e.g. a model image. */
  fallbackUri?: string;
  onChange: (photo: LocalPhoto | null) => void;
  transfer: PhotoTransfer;
  /** On a failed transfer, tapping the tile retries. */
  onRetry?: () => void;
  disabled?: boolean;
  /** What the photo shows, for accessibility labels. */
  name: string;
}

/** Compact photo for list rows that save as soon as a photo is picked. */
export function PhotoTile({
  spec = PHOTO_SPECS.webbing,
  value,
  fallbackUri,
  onChange,
  transfer,
  onRetry,
  disabled,
  name,
}: PhotoTileProps) {
  const { t } = useTranslation();
  const actions = usePhotoActions({ spec, onChange, transfer, disabled });
  const [brokenUri, setBrokenUri] = useState<string>();
  const retry = transfer.state === 'failed' ? onRetry : undefined;
  const shown = value?.uri ?? fallbackUri;
  const image = shown && shown !== brokenUri ? shown : undefined;
  const canPress = !!retry || actions.canEdit;
  const labelKey = retry ? 'retryFor' : image ? 'replaceFor' : 'addFor';

  return (
    <View
      className={cn(
        'h-24 w-20 overflow-hidden rounded-xl border border-border',
        image
          ? 'bg-muted'
          : 'border-dashed border-muted-foreground/35 bg-muted/50',
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(`${translationKey}.a11y.${labelKey}`, { name })}
        accessibilityState={{
          disabled: !canPress,
          busy: isTransferring(transfer),
        }}
        disabled={!canPress}
        onPress={retry ?? actions.choose}
        className="flex-1 items-center justify-center gap-1.5 active:bg-muted/60"
      >
        <TileFace
          image={image}
          isPersonal={!!value}
          onError={setBrokenUri}
          showAddHint={!value && !isTransferring(transfer)}
        />
      </Pressable>
      {value ? (
        <RemoveButton
          visible={actions.canEdit && !retry}
          label={t(`${translationKey}.a11y.removeFor`, { name })}
          onPress={actions.remove}
        />
      ) : null}
      <TileStatus transfer={transfer} />
    </View>
  );
}

function TileFace({
  image,
  isPersonal,
  showAddHint,
  onError,
}: {
  image: string | undefined;
  isPersonal: boolean;
  showAddHint: boolean;
  onError: (uri: string) => void;
}) {
  const { t } = useTranslation();
  if (!image) {
    return (
      <>
        <View className="size-8 items-center justify-center rounded-full border border-border bg-background shadow-sm shadow-black/5">
          <Icon as={ImagePlusIcon} className="size-4 text-foreground" />
        </View>
        <Text className="text-[11px] font-medium text-muted-foreground">
          {t(`${translationKey}.add`)}
        </Text>
      </>
    );
  }
  return (
    <>
      <Image
        source={{ uri: image }}
        contentFit={isPersonal ? 'cover' : 'contain'}
        transition={{ duration: 200, effect: 'cross-dissolve' }}
        onError={() => onError(image)}
        style={StyleSheet.absoluteFill}
      />
      {showAddHint ? (
        // A model image is a placeholder: hint that a photo can be added.
        <View className="absolute bottom-1 right-1 rounded-full bg-black/55 p-1">
          <Icon as={ImagePlusIcon} className="size-3 text-white" />
        </View>
      ) : null}
    </>
  );
}

function RemoveButton({
  visible,
  label,
  onPress,
}: {
  visible: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[styles.remove, { opacity: visible ? 1 : 0 }, OPACITY_TRANSITION]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        hitSlop={12}
        className="h-6 w-6 items-center justify-center rounded-full bg-black/55"
      >
        <Icon as={XIcon} className="size-3 text-white" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  remove: { position: 'absolute', top: 4, right: 4 },
});
