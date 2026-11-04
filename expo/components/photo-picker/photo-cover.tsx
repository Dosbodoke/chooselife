import type { LocalPhoto } from '~/features/photos/photo-file';
import type { PhotoSpec } from '~/features/photos/pick-photo';
import { Image } from 'expo-image';
import { ImagePlusIcon, XIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import { OPACITY_TRANSITION } from './motion';
import { CoverStatus } from './transfer-status';
import { usePhotoActions } from './use-photo-actions';
import { isTransferring, type PhotoTransfer } from './use-photo-transfer';

const translationKey = 'components.photo-picker';

export interface PhotoCoverProps {
  spec: PhotoSpec;
  /** A picked photo or the stored one; anything with a displayable uri. */
  value: { uri: string } | null;
  onChange: (photo: LocalPhoto | null) => void;
  transfer: PhotoTransfer;
  /** Shown on a failed transfer; omit when retrying can't help. */
  onRetry?: () => void;
  disabled?: boolean;
  instructions: string;
}

/**
 * Full-width photo field for forms, cropped to `spec.aspect`. The caller
 * renders the field label, like any other input.
 */
export function PhotoCover({
  spec,
  value,
  onChange,
  transfer,
  onRetry,
  disabled,
  instructions,
}: PhotoCoverProps) {
  const { t } = useTranslation();
  const actions = usePhotoActions({ spec, onChange, transfer, disabled });
  const busy = isTransferring(transfer);

  return (
    <View className="gap-1">
      <View
        className={cn(
          'w-full overflow-hidden rounded-xl border border-border',
          value
            ? 'bg-muted'
            : 'border-dashed border-muted-foreground/35 bg-muted/50',
          actions.pickError && 'border-destructive',
        )}
        style={{ aspectRatio: spec.aspect[0] / spec.aspect[1] }}
      >
        {value ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(`${translationKey}.a11y.replace`)}
              disabled={!actions.canEdit}
              onPress={actions.choose}
              className="flex-1"
            >
              <Image
                source={{ uri: value.uri }}
                contentFit="cover"
                transition={{ duration: 200, effect: 'cross-dissolve' }}
                style={StyleSheet.absoluteFill}
              />
            </Pressable>
            <Animated.View
              pointerEvents={actions.canEdit ? 'box-none' : 'none'}
              style={[
                styles.actions,
                { opacity: busy ? 0 : 1 },
                OPACITY_TRANSITION,
              ]}
            >
              <GlassButton
                icon={ImagePlusIcon}
                label={t(`${translationKey}.replace`)}
                disabled={!actions.canEdit}
                onPress={actions.choose}
              />
              <GlassButton
                icon={XIcon}
                accessibilityLabel={t(`${translationKey}.remove`)}
                disabled={!actions.canEdit}
                onPress={actions.remove}
              />
            </Animated.View>
            <CoverStatus transfer={transfer} onRetry={onRetry} />
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={instructions}
            disabled={!actions.canEdit}
            onPress={actions.choose}
            className={cn(
              'flex-1 items-center justify-center px-6 active:bg-muted/60',
              disabled && 'opacity-50',
            )}
          >
            <View className="mb-3 size-14 items-center justify-center rounded-full border border-border bg-background shadow-sm shadow-black/5">
              <Icon as={ImagePlusIcon} className="size-6 text-foreground" />
            </View>
            <Text className="text-base font-semibold text-foreground">
              {t(`${translationKey}.add`)}
            </Text>
            <Text className="mt-1 max-w-64 text-center text-sm leading-5 text-muted-foreground">
              {instructions}
            </Text>
            <View className="mt-3 rounded-full border border-border bg-background px-2.5 py-1">
              <Text className="text-[11px] font-medium text-muted-foreground">
                {t(`${translationKey}.limits`)}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
      {actions.pickError ? (
        <Text variant="small" className="text-destructive">
          {actions.pickError}
        </Text>
      ) : null}
    </View>
  );
}

function GlassButton({
  icon,
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: typeof XIcon;
  label?: string;
  accessibilityLabel?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        'h-8 flex-row items-center justify-center gap-1.5 rounded-full bg-black/55 active:bg-black/70',
        label ? 'px-3' : 'w-8',
        disabled && 'opacity-50',
      )}
    >
      <Icon as={icon} className="size-4 text-white" />
      {label ? (
        <Text className="text-xs font-semibold text-white">{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
});
