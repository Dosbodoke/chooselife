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
import {
  summarizeUsage,
  type UsageSummary,
} from '~/features/webbing/inventory-display';
import { Link } from 'expo-router';
import {
  ChevronRightIcon,
  PackageIcon,
  TagIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
import { WebbingLifetimeMeter } from '~/components/webbing-lifetime-meter';

import { InventoryChip } from './inventory-chip';
import { PRESS_IN } from './inventory-motion';
import { InventoryReveal } from './inventory-reveal';

const translationKey = 'components.settings.my-webbing';

const STATUS_COLORS: Record<WebbingLifetimeStatus, string> = {
  good: '#059669',
  unknown: '#059669',
  inspect: '#b45309',
  replace: '#dc2626',
};

const STATUS_CHIP: Record<WebbingLifetimeStatus, string> = {
  good: 'bg-emerald-50',
  unknown: 'bg-slate-100',
  inspect: 'bg-amber-50',
  replace: 'bg-red-50',
};

const STATUS_TEXT: Record<WebbingLifetimeStatus, string> = {
  good: 'text-emerald-700',
  unknown: 'text-slate-600',
  inspect: 'text-amber-800',
  replace: 'text-red-700',
};

/** The ID field's end padding, the hairline and the length field's start. */
const FIELD_SEPARATION = 16 + 1 + 16;

const FIELD_VALUE = 'text-[17px] font-semibold leading-[22px] text-slate-900';

/**
 * One physical webbing, led by its ID and length. Below them, at full width,
 * each kind of detail gets its own place: model and the owner's name as
 * labelled lines, rigged state and strength claims as chips, then use. The
 * whole row opens its history; the photo control on top of it is a separate
 * button for the personal photo.
 *
 * A model with a catalog photo needs no personal-photo control in its short
 * card. Models without a catalog image keep the personal-photo picker.
 */
export function WebbingInventoryRow({
  entry,
  subject,
  idDigits,
  claims,
  hasModelPhoto,
  hidden,
  animate,
  order,
  first,
  last,
}: {
  entry: InventoryEntry<WebbingWithUsage>;
  /** The group the row sits in, so it does not repeat the heading. */
  subject: InventoryGroupSubject;
  /** Digits in the card's widest ID, so every row's length lines up. */
  idDigits: number;
  claims: StrengthClaim[];
  /** The model has a catalog photo, in the heading or not. */
  hasModelPhoto: boolean;
  /** Collapsed or filtered out: kept mounted so a photo save keeps its state. */
  hidden: boolean;
  /** Whether a change in `hidden` came from collapsing or expanding. */
  animate: boolean;
  /** Position in the group, for the short stagger when it expands. */
  order: number;
  first: boolean;
  last: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { webbing, specs, customName } = entry;
  const { data, isError: usageError } = useWebbingUsage(
    webbing.id,
    specs.recommendedLifetimeDays,
  );
  const usage = summarizeUsage(data);
  const model = useModelLabel(entry, subject);
  const idLabel = `ID ${webbing.id}`;
  // A no-break space keeps the unit with its number.
  const length = `${webbing.length.toLocaleString(i18n.language)}\u00A0m`;
  const photo = useWebbingPhotoTile(
    webbing,
    `${idLabel} · ${getWebbingName(webbing)}`,
  );
  const claimLabels = claims.map(({ strength, claim }) => ({
    text: t(
      `${translationKey}.${claim === 'model' ? 'strength' : 'personalStrength'}`,
      { strength },
    ),
    // An owner's class next to a different model class is a conflict.
    conflict: claim === 'personal' && !!specs.modelStrengthClass,
  }));
  const metrics = useUsageMetrics(usage);
  const status =
    usage?.kind === 'lifetime'
      ? getTranslatedStatus(usage.status, i18n.language)
      : null;
  const shape = useLastShownShape(hidden, first, last);
  const press = usePressHighlight();

  return (
    <InventoryReveal
      hidden={hidden}
      animate={animate}
      order={order}
      className={cn(
        'border-x border-slate-200 bg-white',
        shape.first && 'rounded-t-2xl border-t',
        shape.last && 'rounded-b-2xl border-b',
      )}
    >
      {!shape.first ? <View className="mx-4 h-px bg-slate-100" /> : null}
      <View>
        <Link asChild href={`/webbing/${webbing.id}`}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={[
              idLabel,
              `${t(`${translationKey}.length`)} ${length}`,
              webbing.isUsed ? t(`${translationKey}.riggedNow`) : null,
              model
                ? t(`${translationKey}.a11y.model`, { model: model.text })
                : null,
              customName
                ? t(`${translationKey}.a11y.name`, { name: customName })
                : null,
              ...claimLabels.map((claim) => claim.text),
              ...metrics.map(({ value, label }) => `${value} ${label}`),
              status,
              usageError ? t(`${translationKey}.usageError`) : null,
            ]
              .filter(Boolean)
              .join(', ')}
            accessibilityHint={t(`${translationKey}.viewHistoryHint`)}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            style={StyleSheet.absoluteFill}
            className={cn(
              'overflow-hidden',
              shape.first && 'rounded-t-2xl',
              shape.last && !photo.error && 'rounded-b-2xl',
            )}
          >
            <Animated.View
              style={[StyleSheet.absoluteFill, press.style]}
              className="bg-slate-50"
            />
          </Pressable>
        </Link>
        <View pointerEvents="box-none" className="gap-2.5 py-3 pl-4 pr-2">
          <View
            pointerEvents="box-none"
            className="flex-row items-center gap-3"
          >
            <IdentityFields
              id={webbing.id}
              idDigits={idDigits}
              length={length}
            />
            {!hasModelPhoto ? <PhotoTile {...photo.tile} compact /> : null}
            <View pointerEvents="none">
              <Icon
                as={ChevronRightIcon}
                size={16}
                className="text-slate-300"
              />
            </View>
          </View>
          <RowDetails
            model={model}
            customName={customName}
            rigged={webbing.isUsed}
            claims={claimLabels}
            usage={usage}
            usageError={usageError}
            metrics={metrics}
            status={status}
          />
        </View>
      </View>
      {photo.error ? (
        <View className="flex-row flex-wrap items-center gap-x-3 pb-3 pl-4 pr-3">
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
    </InventoryReveal>
  );
}

/** Where the row sat in its card when last shown: it fades out as it was. */
function useLastShownShape(hidden: boolean, first: boolean, last: boolean) {
  const [shape, setShape] = useState({ first, last });
  if (!hidden && (shape.first !== first || shape.last !== last))
    setShape({ first, last });
  return shape;
}

/**
 * The row's pressed tint: in over ~100 ms like the reference press, out a
 * little slower so a quick tap still registers.
 */
function usePressHighlight() {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: pressed.get() }));
  return {
    style,
    onPressIn: () => pressed.set(withTiming(1, PRESS_IN)),
    onPressOut: () => pressed.set(withTiming(0, { duration: 150 })),
  };
}

/** Everything below the ID and length, at full width; nothing if empty. */
function RowDetails({
  model,
  customName,
  rigged,
  claims,
  usage,
  usageError,
  metrics,
  status,
}: {
  model: { text: string; muted?: boolean } | null;
  customName: string | null;
  rigged: boolean;
  claims: { text: string; conflict: boolean }[];
  usage: UsageSummary | null;
  usageError: boolean;
  metrics: { value: string; label: string }[];
  status: string | null;
}) {
  const { t } = useTranslation();
  if (
    !model &&
    !customName &&
    !rigged &&
    !claims.length &&
    !usage &&
    !usageError
  )
    return null;
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="gap-2 pr-2"
    >
      {model ? (
        <DetailLine
          icon={PackageIcon}
          className={model.muted ? 'text-slate-400' : 'text-slate-600'}
        >
          {model.text}
        </DetailLine>
      ) : null}
      {customName ? (
        <DetailLine icon={TagIcon} className="text-slate-800">
          {customName}
        </DetailLine>
      ) : null}
      <RowChips rigged={rigged} claims={claims} />
      {usageError ? (
        <Text className="text-xs leading-4 text-slate-500">
          {t(`${translationKey}.usageError`)}
        </Text>
      ) : usage ? (
        <UsageDetails usage={usage} metrics={metrics} status={status} />
      ) : null}
    </View>
  );
}

/** The rigged state and strength claims, each a chip that wraps whole. */
function RowChips({
  rigged,
  claims,
}: {
  rigged: boolean;
  claims: { text: string; conflict: boolean }[];
}) {
  const { t } = useTranslation();
  if (!rigged && !claims.length) return null;
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {rigged ? (
        <InventoryChip
          className="rounded-full bg-emerald-50 px-2"
          textClassName="font-semibold text-emerald-700"
          leading={<View className="size-1.5 rounded-full bg-emerald-500" />}
        >
          {t(`${translationKey}.riggedNow`)}
        </InventoryChip>
      ) : null}
      {claims.map(({ text, conflict }) => (
        <InventoryChip
          key={text}
          className={cn(
            'border bg-white',
            conflict ? 'border-amber-300' : 'border-slate-200',
          )}
          textClassName={conflict ? 'text-amber-800' : undefined}
        >
          {text}
        </InventoryChip>
      ))}
    </View>
  );
}

/** Use as separate figures; against a lifetime, a verdict and a gauge too. */
function UsageDetails({
  usage,
  metrics,
  status,
}: {
  usage: UsageSummary;
  metrics: { value: string; label: string }[];
  status: string | null;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
        {/* Nested `Text` resets to the base size, so each span restates it. */}
        {metrics.map(({ value, label }) => (
          <Text
            key={label}
            className="text-[13px] leading-[18px] text-slate-500"
          >
            <Text
              className="text-[13px] font-semibold text-slate-800"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {value}
            </Text>{' '}
            {label}
          </Text>
        ))}
        {usage.kind === 'lifetime' && status ? (
          <InventoryChip
            className={cn('ml-auto', STATUS_CHIP[usage.status])}
            textClassName={cn('font-semibold', STATUS_TEXT[usage.status])}
          >
            {status}
          </InventoryChip>
        ) : null}
      </View>
      {usage.kind === 'lifetime' ? (
        <WebbingLifetimeMeter
          percentUsed={usage.percentUsed}
          color={STATUS_COLORS[usage.status]}
          className="h-1.5"
        />
      ) : null}
    </View>
  );
}

/** A labelled line of text; the icon says what kind of text it is. */
function DetailLine({
  icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: string;
}) {
  return (
    <View className="flex-row items-start gap-1.5">
      <Icon as={icon} size={14} className="mt-[3px] text-slate-400" />
      <Text className={cn('flex-1 text-sm leading-5', className)}>
        {children}
      </Text>
    </View>
  );
}

/** Use as separate figures, each with its own unit, in the owner's locale. */
function useUsageMetrics(usage: UsageSummary | null) {
  const { t, i18n } = useTranslation();
  if (!usage) return [];
  const format = (value: number) => value.toLocaleString(i18n.language);
  return [
    {
      value: format(usage.usageDays),
      label:
        usage.kind === 'lifetime'
          ? t(`${translationKey}.usage.ofLifetime`, {
              total: format(usage.lifetimeDays),
            })
          : t(`${translationKey}.usage.days`, { count: usage.usageDays }),
    },
    {
      value: format(usage.rigCount),
      label: t(`${translationKey}.usage.rigs`, { count: usage.rigCount }),
    },
  ];
}

/**
 * ID and length as two labelled fields of equal weight, split by a hairline.
 * The ID field is as wide as the card's widest ID. When both fields do not
 * fit on one line, at large text sizes or narrow widths, the length moves
 * under the ID, whole, and the hairline goes with it.
 */
function IdentityFields({
  id,
  idDigits,
  length,
}: {
  id: number;
  idDigits: number;
  length: string;
}) {
  const { t } = useTranslation();
  const [widths, setWidths] = useState({ available: 0, id: 0, length: 0 });
  // Fields are measured without their separation, so stacking them never
  // changes what decides it.
  const measure =
    (key: keyof typeof widths) =>
    ({ nativeEvent }: LayoutChangeEvent) => {
      const { width } = nativeEvent.layout;
      setWidths((current) =>
        current[key] === width ? current : { ...current, [key]: width },
      );
    };
  const stacked =
    widths.available > 0 &&
    widths.id + FIELD_SEPARATION + widths.length > widths.available;

  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={measure('available')}
      className="flex-1 min-w-0"
    >
      <View className={stacked ? 'items-start gap-1.5' : 'flex-row'}>
        <View className={stacked ? undefined : 'pr-4'}>
          <Field label="ID" onLayout={measure('id')}>
            <Text
              className={FIELD_VALUE}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {id}
            </Text>
            {/* Tabular digits share one width, so this reserves the widest. */}
            <Text
              className={cn(FIELD_VALUE, 'h-0 opacity-0')}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {'0'.repeat(idDigits)}
            </Text>
          </Field>
        </View>
        <View
          className={stacked ? undefined : 'border-l border-slate-200 pl-4'}
        >
          <Field
            label={t(`${translationKey}.length`)}
            onLayout={measure('length')}
          >
            <Text
              className={FIELD_VALUE}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {length}
            </Text>
          </Field>
        </View>
      </View>
    </View>
  );
}

/** A quiet label above its value. */
function Field({
  label,
  onLayout,
  children,
}: {
  label: string;
  onLayout: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  return (
    <View onLayout={onLayout}>
      <Text className="text-xs leading-4 text-slate-500">{label}</Text>
      {children}
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
function useWebbingPhotoTile(webbing: WebbingWithUsage, name: string) {
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
