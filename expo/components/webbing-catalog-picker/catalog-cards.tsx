import type { WebbingCatalogSnapshot } from '@chooselife/ui';
import {
  catalogFlags,
  stretchReference,
  type CatalogFlag,
  type CatalogSortKey,
} from '~/features/webbing/catalog-browse';
import { Image } from 'expo-image';
import {
  AlertTriangleIcon,
  ArchiveIcon,
  CheckIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const translationKey = 'app.(modals).register-webbing.selectModel';

const MATERIAL_DOT: Record<string, string> = {
  Polyester: 'bg-violet-600',
  Nylon: 'bg-blue-600',
  'Dyneema/HMPE': 'bg-emerald-600',
  Vectran: 'bg-amber-600',
};

export interface CatalogCardProps {
  model: WebbingCatalogSnapshot;
  /** A Choose Life–owned image; SlackData never supplies one. */
  imageUri?: string | null;
  selected: boolean;
  sortKey: CatalogSortKey;
  onPress: () => void;
  accessibilityLabel: string;
  /** Fixed width for grid cells; wide cards stretch. */
  width?: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const orDash = (value: number | null) => (value === null ? '—' : String(value));

/** Shown only when an image exists; never a placeholder. */
function CornerPhoto({
  uri,
  size,
  name,
}: {
  uri?: string | null;
  size: number;
  name: string;
}) {
  const { t } = useTranslation();
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      contentFit="cover"
      accessibilityLabel={t(`${translationKey}.card.photoOf`, { name })}
      style={{
        width: size,
        height: size,
        borderRadius: size / 5,
        backgroundColor: '#f4f4f5',
      }}
    />
  );
}

const FLAG_STYLE: Record<
  CatalogFlag['kind'],
  { icon: LucideIcon; box: string; text: string }
> = {
  'isa-warning': {
    icon: AlertTriangleIcon,
    box: 'bg-red-100',
    text: 'text-red-700',
  },
  'not-for-highline': {
    icon: AlertTriangleIcon,
    box: 'bg-red-100',
    text: 'text-red-700',
  },
  isa: {
    icon: ShieldCheckIcon,
    box: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  discontinued: {
    icon: ArchiveIcon,
    box: 'bg-slate-100',
    text: 'text-slate-600',
  },
};

export function CatalogFlags({ model }: { model: WebbingCatalogSnapshot }) {
  const { t } = useTranslation();
  const flags = catalogFlags(model);
  if (!flags.length) return null;
  return (
    <View className="flex-row flex-wrap gap-1">
      {flags.map((flag) => {
        const style = FLAG_STYLE[flag.kind];
        const label =
          flag.kind === 'isa-warning'
            ? flag.text
            : flag.kind === 'isa'
              ? flag.isaClass
                ? t(`${translationKey}.flags.isa`, { class: flag.isaClass })
                : t(`${translationKey}.flags.isaCertified`)
              : t(
                  `${translationKey}.flags.${flag.kind === 'not-for-highline' ? 'notForHighline' : 'discontinued'}`,
                );
        return (
          <View
            key={flag.kind}
            className={cn(
              'flex-row items-center gap-1 rounded px-1.5 py-0.5',
              style.box,
            )}
          >
            <Icon as={style.icon} size={10} className={style.text} />
            <Text className={cn('text-[10px] font-semibold', style.text)}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Materials({ model }: { model: WebbingCatalogSnapshot }) {
  const { t } = useTranslation();
  const materials = model.materials;
  return (
    <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
      {materials ? (
        materials.map((material) => (
          <View key={material} className="flex-row items-center gap-1">
            <View
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                MATERIAL_DOT[material] ?? 'bg-slate-400',
              )}
            />
            <Text className="text-xs text-muted-foreground">{material}</Text>
          </View>
        ))
      ) : (
        <Text className="text-xs text-muted-foreground">
          {t('components.webbing-detail.specifications.notRecorded')}
        </Text>
      )}
      {model.construction ? (
        <Text className="text-xs text-muted-foreground">
          · {model.construction}
        </Text>
      ) : null}
    </View>
  );
}

function CardHeader({
  model,
  imageUri,
  photoSize,
  selected,
}: {
  model: WebbingCatalogSnapshot;
  imageUri?: string | null;
  photoSize: number;
  selected: boolean;
}) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="flex-1 gap-0.5">
        {model.brandName ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {model.brandName}
          </Text>
        ) : null}
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={2}
        >
          {[model.name, model.version].filter(Boolean).join(' ')}
        </Text>
      </View>
      <CornerPhoto uri={imageUri} size={photoSize} name={model.name} />
      {selected && !imageUri ? (
        <Icon as={CheckIcon} size={16} className="text-primary" />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Variant `control`: two-column cards with four labelled spec tiles
// ---------------------------------------------------------------------------

function Tile({
  value,
  label,
  highlighted,
}: {
  value: string;
  label: string;
  highlighted: boolean;
}) {
  return (
    <View
      className={cn(
        'w-[47%] grow rounded-lg px-2 py-1.5',
        highlighted ? 'bg-foreground' : 'bg-muted',
      )}
    >
      <Text
        className={cn(
          'text-[15px] font-bold',
          highlighted ? 'text-background' : 'text-foreground',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text
        className={cn(
          'text-[10px]',
          highlighted ? 'text-background' : 'text-muted-foreground',
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

export function SpecTilesCard({
  model,
  imageUri,
  selected,
  sortKey,
  onPress,
  accessibilityLabel,
  width,
}: CatalogCardProps) {
  const { t } = useTranslation();
  const stretch = stretchReference(model);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={width ? { width } : undefined}
      className={cn(
        'gap-2 rounded-2xl border p-3',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background',
      )}
    >
      <CatalogFlags model={model} />
      <CardHeader
        model={model}
        imageUri={imageUri}
        photoSize={52}
        selected={selected}
      />
      <Materials model={model} />
      <View className="flex-row flex-wrap gap-1.5">
        <Tile
          value={orDash(model.breakingStrengthKn)}
          label={t(`${translationKey}.card.kn`)}
          highlighted={sortKey === 'strength'}
        />
        <Tile
          value={orDash(model.widthMm)}
          label={t(`${translationKey}.card.mm`)}
          highlighted={sortKey === 'width'}
        />
        <Tile
          value={orDash(model.weightGramsPerMeter)}
          label={t(`${translationKey}.card.gramsPerMeter`)}
          highlighted={sortKey === 'weight'}
        />
        <Tile
          value={stretch ? String(round1(stretch.percent)) : '—'}
          label={
            stretch
              ? t(`${translationKey}.card.stretchAt`, { kn: stretch.kn })
              : t(`${translationKey}.card.stretch`)
          }
          highlighted={sortKey === 'stretch'}
        />
      </View>
      {selected && imageUri ? (
        <View className="absolute bottom-2 right-2 h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Icon as={CheckIcon} size={12} className="text-primary-foreground" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Variant `wide`: one card per row with a stat strip and stretch curve
// ---------------------------------------------------------------------------

function Stat({
  value,
  unit,
  highlighted,
}: {
  value: string;
  unit: string;
  highlighted: boolean;
}) {
  return (
    <View className="flex-1 items-center gap-0.5">
      <Text
        className={cn(
          'rounded px-1 text-[17px] font-bold text-foreground',
          highlighted && 'bg-amber-100',
        )}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text
        className={cn(
          'text-[10px]',
          highlighted
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground',
        )}
      >
        {unit}
      </Text>
    </View>
  );
}

function StatDivider() {
  return <View className="w-px self-stretch bg-border" />;
}

/** Load (x) vs elongation (y); a single point is shown as a value only. */
function StretchCurve({
  points,
  width,
  height = 22,
}: {
  points: { kn: number; percent: number }[];
  width: number;
  height?: number;
}) {
  const maxKn = Math.max(...points.map((p) => p.kn)) || 1;
  const maxPct = Math.max(...points.map((p) => p.percent)) || 1;
  const path = points
    .map(
      (p) =>
        `${((p.kn / maxKn) * (width - 2) + 1).toFixed(1)},${(
          height -
          1 -
          (p.percent / maxPct) * (height - 2)
        ).toFixed(1)}`,
    )
    .join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={path} fill="none" stroke="#18181b" strokeWidth={1.5} />
    </Svg>
  );
}

export function WideCard({
  model,
  imageUri,
  selected,
  sortKey,
  onPress,
  accessibilityLabel,
  width,
}: CatalogCardProps) {
  const { t } = useTranslation();
  const stretch = stretchReference(model);
  const curve =
    model.stretch && model.stretch.length > 1 ? model.stretch : null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cn(
        'gap-3 rounded-2xl border p-3.5',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-background',
      )}
    >
      <View className="flex-row items-start gap-3">
        <View className="flex-1 gap-1">
          <CatalogFlags model={model} />
          {model.brandName ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {model.brandName}
            </Text>
          ) : null}
          <Text
            className="text-base font-semibold text-foreground"
            numberOfLines={1}
          >
            {[model.name, model.version].filter(Boolean).join(' ')}
          </Text>
          <Materials model={model} />
        </View>
        <CornerPhoto uri={imageUri} size={72} name={model.name} />
        {selected && !imageUri ? (
          <Icon as={CheckIcon} size={18} className="text-primary" />
        ) : null}
      </View>
      <View className="flex-row border-y border-border py-2.5">
        <Stat
          value={orDash(model.breakingStrengthKn)}
          unit={t(`${translationKey}.card.kn`)}
          highlighted={sortKey === 'strength'}
        />
        <StatDivider />
        <Stat
          value={orDash(model.widthMm)}
          unit={t(`${translationKey}.card.mm`)}
          highlighted={sortKey === 'width'}
        />
        <StatDivider />
        <Stat
          value={orDash(model.weightGramsPerMeter)}
          unit={t(`${translationKey}.card.gramsPerMeter`)}
          highlighted={sortKey === 'weight'}
        />
        <StatDivider />
        <Stat
          value={stretch ? `${round1(stretch.percent)}%` : '—'}
          unit={
            stretch
              ? t(`${translationKey}.card.atKn`, { kn: stretch.kn })
              : t(`${translationKey}.card.stretch`)
          }
          highlighted={sortKey === 'stretch'}
        />
      </View>
      {curve && width ? (
        <View className="flex-row items-center gap-2.5">
          <StretchCurve points={curve} width={width - 28 - 88} />
          <Text className="w-[78px] text-right text-[10px] text-muted-foreground">
            {t(`${translationKey}.card.stretchCurve`)}
          </Text>
        </View>
      ) : null}
      {selected && imageUri ? (
        <View className="absolute bottom-2 right-2 h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Icon as={CheckIcon} size={12} className="text-primary-foreground" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
