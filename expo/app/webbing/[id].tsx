import {
  getTranslatedStatus,
  resolveWebbingSpecs,
  useWebbingHistory,
  useWebbingUsage,
  type ResolvedWebbingSpecs,
  type WebbingLifetimeStatus,
  type WebbingRigHistory,
} from '@chooselife/ui';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  CalendarIcon,
  ExternalLinkIcon,
  FactoryIcon,
  LayersIcon,
  LinkIcon,
  MapPinIcon,
  MoveHorizontalIcon,
  ShieldIcon,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  getWebbingName,
  useUserWebbings,
  type WebbingWithUsage,
} from '~/hooks/use-webbings';
import { cn } from '~/lib/utils';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import {
  CatalogAttribution,
  CatalogSpecs,
} from '~/components/webbing-catalog-specs';

const translationKey = 'components.webbing-detail';

// ISA webbing document URL
const ISA_WEBBING_PDF_URL =
  'https://data.slacklineinternational.org/publications/accident-reports/highline_webbing_lifetime_warning_2022_v1_en.pdf/';

const STATUS_COLORS: Record<
  WebbingLifetimeStatus,
  { text: string; bar: string }
> = {
  good: { text: 'text-emerald-700', bar: 'bg-emerald-500' },
  inspect: { text: 'text-amber-700', bar: 'bg-amber-500' },
  replace: { text: 'text-red-700', bar: 'bg-red-500' },
  unknown: { text: 'text-muted-foreground', bar: 'bg-slate-300' },
};

const ICON_TONES = {
  blue: { box: 'bg-blue-100', icon: 'text-blue-600' },
  emerald: { box: 'bg-emerald-100', icon: 'text-emerald-600' },
  amber: { box: 'bg-amber-100', icon: 'text-amber-600' },
  violet: { box: 'bg-violet-100', icon: 'text-violet-600' },
  slate: { box: 'bg-slate-100', icon: 'text-slate-600' },
} as const;

export default function WebbingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const webbingId = id ? parseInt(id, 10) : undefined;
  const { data: webbings, isPending } = useUserWebbings();
  const webbing = webbings?.find((w) => w.id === webbingId);

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!webbing) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-muted-foreground">
          {t(`${translationKey}.notFound`)}
        </Text>
      </View>
    );
  }

  return <WebbingDetail webbing={webbing} />;
}

function WebbingDetail({ webbing }: { webbing: WebbingWithUsage }) {
  // Saved SlackData snapshot first, then the legacy model, else unknown.
  const specs = resolveWebbingSpecs(webbing);

  return (
    <>
      <Stack.Screen options={{ title: '', headerTransparent: true }} />
      <ScrollView
        className="flex-1 bg-muted/30"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="pt-16 pb-12 gap-4"
      >
        <IdentityCard webbing={webbing} modelName={specs.modelName} />
        {/* Always shown for an owned item */}
        <LifetimeCard webbingId={webbing.id} specs={specs} />
        <SpecificationsCard webbing={webbing} specs={specs} />
        <CatalogSourceCard specs={specs} />
        <UsageHistoryCard
          webbingId={webbing.id}
          recommendedDays={specs.recommendedLifetimeDays}
        />
      </ScrollView>
    </>
  );
}

function DetailCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <View
      className={cn(
        'mx-4 p-4 rounded-2xl bg-card border border-border',
        className,
      )}
    >
      {children}
    </View>
  );
}

function IdentityCard({
  webbing,
  modelName,
}: {
  webbing: WebbingWithUsage;
  modelName: string | null;
}) {
  return (
    <DetailCard>
      <View className="flex-row gap-4">
        <View className="items-center justify-center w-20 h-20 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5">
          <Text className="text-xs font-medium text-primary/70 uppercase tracking-wide">
            ID
          </Text>
          <Text className="text-3xl font-bold text-primary">{webbing.id}</Text>
        </View>

        <View className="flex-1 justify-center gap-2">
          <Text className="text-xl font-bold text-foreground" numberOfLines={2}>
            {getWebbingName(webbing)}
          </Text>
          {modelName && (
            <Text className="text-sm text-muted-foreground">{modelName}</Text>
          )}
        </View>
      </View>
    </DetailCard>
  );
}

function LifetimeCard({
  webbingId,
  specs,
}: {
  webbingId: number;
  specs: ResolvedWebbingSpecs;
}) {
  const { t } = useTranslation();
  const strengthClass =
    specs.modelStrengthClass?.value ?? specs.personalStrengthClass;

  return (
    <DetailCard className="overflow-hidden">
      {strengthClass && <StrengthWatermark value={strengthClass} />}
      <View className="mb-4">
        <View className="flex-row items-center gap-2">
          <Icon as={ShieldIcon} size={20} className="text-primary" />
          <Text className="text-lg font-semibold text-foreground">
            {t(`${translationKey}.lifetime.title`)}
          </Text>
        </View>
        <LifetimeEstimate
          webbingId={webbingId}
          recommendedDays={specs.recommendedLifetimeDays}
        />
      </View>
      <UsageProgress
        webbingId={webbingId}
        recommendedDays={specs.recommendedLifetimeDays}
      />
      <TouchableOpacity
        onPress={() => Linking.openURL(ISA_WEBBING_PDF_URL)}
        className="flex-row items-center justify-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200"
      >
        <Icon as={ExternalLinkIcon} size={16} className="text-blue-600" />
        <Text className="text-sm font-medium text-blue-700">
          {t(`${translationKey}.lifetime.learnMore`)}
        </Text>
      </TouchableOpacity>
    </DetailCard>
  );
}

/** Large decorative strength class that blends into the card background. */
function StrengthWatermark({ value }: { value: string }) {
  return (
    <View
      className="absolute -top-4 -right-2"
      style={{ opacity: 0.06 }}
      pointerEvents="none"
    >
      <Text
        style={{ fontSize: 140, fontWeight: '900', lineHeight: 140 }}
        className="text-primary"
      >
        {value}
      </Text>
    </View>
  );
}

function LifetimeEstimate({
  webbingId,
  recommendedDays,
}: {
  webbingId: number;
  recommendedDays: number | null;
}) {
  const { t, i18n } = useTranslation();
  const { data: usage } = useWebbingUsage(webbingId, recommendedDays);

  if (!recommendedDays) {
    return (
      <Text className="text-sm text-muted-foreground mt-1">
        {t(`${translationKey}.lifetime.unknown`)}
      </Text>
    );
  }
  return (
    <>
      {usage && (
        <Text className={cn('text-sm mt-1', STATUS_COLORS[usage.status].text)}>
          {t(`${translationKey}.lifetime.status`, {
            status: getTranslatedStatus(usage.status, i18n.language),
          })}
        </Text>
      )}
      <Text className="text-xs text-muted-foreground mt-0.5">
        {t(`${translationKey}.lifetime.recommendedLifetime`, {
          days: recommendedDays,
        })}
      </Text>
    </>
  );
}

function UsageProgress({
  webbingId,
  recommendedDays,
}: {
  webbingId: number;
  recommendedDays: number | null;
}) {
  const { t } = useTranslation();
  const usage = useWebbingUsage(webbingId, recommendedDays);
  const data = usage.data;

  if (usage.isError) {
    return (
      <LoadError
        message={t(`${translationKey}.lifetime.loadError`)}
        onRetry={() => void usage.refetch()}
        className="mb-3"
      />
    );
  }
  if (!data) return <Skeleton className="h-4 w-full rounded mb-3" />;

  return (
    <>
      {/* Only against a supported lifetime */}
      {data.percentageUsed !== null && (
        <View className="mb-2 h-3 rounded-full bg-muted overflow-hidden">
          <View
            className={cn(
              'h-full rounded-full',
              STATUS_COLORS[data.status].bar,
            )}
            style={{
              width: `${Math.max(0, Math.min(100, data.percentageUsed))}%`,
            }}
          />
        </View>
      )}
      <View className="flex-row justify-between mb-3">
        <Text className="text-sm text-muted-foreground">
          {t(`${translationKey}.usage.days`, { count: data.usageDays })} ·{' '}
          {t(`${translationKey}.usage.rigs`, { count: data.rigCount })}
        </Text>
        {data.remainingDays !== null && (
          <Text className="text-sm text-muted-foreground">
            {t(`${translationKey}.lifetime.daysRemaining`, {
              days: data.remainingDays,
            })}
          </Text>
        )}
      </View>
    </>
  );
}

function LoadError({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <View className={cn('gap-2', className)}>
      <Text className="text-sm text-muted-foreground">{message}</Text>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onPress={onRetry}
      >
        <Text>{t(`${translationKey}.lifetime.retry`)}</Text>
      </Button>
    </View>
  );
}

function SpecificationsCard({
  webbing,
  specs,
}: {
  webbing: WebbingWithUsage;
  specs: ResolvedWebbingSpecs;
}) {
  const { t } = useTranslation();
  const key = `${translationKey}.specifications`;
  const loops = Number(!!webbing.left_loop) + Number(!!webbing.right_loop);

  return (
    <DetailCard>
      <Text className="text-lg font-semibold text-foreground mb-3">
        {t(`${key}.title`)}
      </Text>

      <View className="gap-3">
        <SpecRow
          icon={MoveHorizontalIcon}
          tone="blue"
          label={t(`${key}.length`)}
          value={`${webbing.length}m`}
        />
        {specs.source === 'legacy' && specs.legacyModel && (
          <>
            <SpecRow
              icon={FactoryIcon}
              tone="emerald"
              label={t(`${key}.material`)}
              value={specs.legacyModel.material}
              valueClassName="capitalize"
            />
            <SpecRow
              icon={LayersIcon}
              tone="amber"
              label={t(`${key}.weave`)}
              value={specs.legacyModel.weave}
              valueClassName="capitalize"
            />
          </>
        )}
        {/* Model class and personal class keep their sources */}
        {specs.modelStrengthClass && (
          <SpecRow
            icon={ShieldIcon}
            tone="slate"
            label={t(
              `${key}.${specs.modelStrengthClass.origin === 'slackdata' ? 'isaClass' : 'modelStrength'}`,
            )}
            value={specs.modelStrengthClass.value}
          />
        )}
        {specs.personalStrengthClass && (
          <SpecRow
            icon={ShieldIcon}
            tone="slate"
            label={t(`${key}.personalStrength`)}
            value={specs.personalStrengthClass}
          />
        )}
        <SpecRow
          icon={LinkIcon}
          tone="violet"
          label={t(`${key}.loops`)}
          value={`${loops} ${t(loops === 2 ? 'common.loops' : 'common.loop')}`}
        />
      </View>
    </DetailCard>
  );
}

function SpecRow({
  icon,
  tone,
  label,
  value,
  valueClassName,
}: {
  icon: LucideIcon;
  tone: keyof typeof ICON_TONES;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={cn(
          'w-10 h-10 rounded-lg items-center justify-center',
          ICON_TONES[tone].box,
        )}
      >
        <Icon as={icon} size={20} className={ICON_TONES[tone].icon} />
      </View>
      <View>
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className={cn('font-medium', valueClassName)}>{value}</Text>
      </View>
    </View>
  );
}

/** Saved SlackData details with attribution. */
function CatalogSourceCard({ specs }: { specs: ResolvedWebbingSpecs }) {
  const { t, i18n } = useTranslation();

  if (specs.catalog) {
    return (
      <DetailCard className="gap-3">
        <Text className="text-lg font-semibold text-foreground">
          {t(`${translationKey}.source.title`)}
        </Text>
        <CatalogSpecs snapshot={specs.catalog} />
        <Text className="text-xs text-muted-foreground">
          {t(`${translationKey}.source.retrievedAt`, {
            date: new Date(specs.catalog.retrievedAt).toLocaleDateString(
              i18n.language,
            ),
          })}
        </Text>
        <CatalogAttribution />
      </DetailCard>
    );
  }
  if (specs.source !== 'unsupported') return null;
  return (
    <DetailCard>
      <Text className="text-sm text-muted-foreground">
        {t(`${translationKey}.source.unsupported`)}
      </Text>
    </DetailCard>
  );
}

function UsageHistoryCard({
  webbingId,
  recommendedDays,
}: {
  webbingId: number;
  recommendedDays: number | null;
}) {
  const { t } = useTranslation();
  const { data: usage } = useWebbingUsage(webbingId, recommendedDays);
  const history = useWebbingHistory(webbingId);

  return (
    <DetailCard>
      <Text className="text-lg font-semibold text-foreground mb-3">
        {t(`${translationKey}.history.title`, {
          count: usage?.rigCount ?? history.data.length,
        })}
      </Text>
      <UsageHistoryList history={history} />
    </DetailCard>
  );
}

function UsageHistoryList({
  history,
}: {
  history: ReturnType<typeof useWebbingHistory>;
}) {
  const { t } = useTranslation();

  if (history.isError) {
    return (
      <LoadError
        message={t(`${translationKey}.history.loadError`)}
        onRetry={() => void history.refetch()}
        className="py-2"
      />
    );
  }
  if (history.isPending) {
    return <Skeleton className="h-16 w-full rounded-lg" />;
  }
  if (history.data.length === 0) {
    return (
      <View className="py-6 items-center">
        <Text className="text-muted-foreground text-center">
          {t(`${translationKey}.history.empty`)}
        </Text>
      </View>
    );
  }
  return (
    <View className="gap-3">
      {history.data.map((rig) => (
        <RigHistoryRow key={rig.setupId} rig={rig} />
      ))}
    </View>
  );
}

function RigHistoryRow({ rig }: { rig: WebbingRigHistory }) {
  const { t } = useTranslation();
  const isMain = rig.webbingType === 'main';

  return (
    <View className="flex-row items-center gap-3 p-3 rounded-lg bg-muted/30">
      <View className="w-10 h-10 rounded-lg bg-blue-100 items-center justify-center">
        <Icon as={MapPinIcon} size={20} className="text-blue-600" />
      </View>
      <View className="flex-1">
        <Text className="font-medium" numberOfLines={1}>
          {rig.highlineName}
        </Text>
        <View className="flex-row items-center gap-2">
          <Icon as={CalendarIcon} size={12} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">
            {new Date(rig.rigDate).toLocaleDateString()} •{' '}
            {t(`${translationKey}.history.days`, { days: rig.durationDays })}
          </Text>
        </View>
      </View>
      <View
        className={cn(
          'px-2 py-0.5 rounded-full',
          isMain ? 'bg-primary/10' : 'bg-muted',
        )}
      >
        <Text
          className={cn(
            'text-[10px] font-medium uppercase',
            isMain ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {rig.webbingType}
        </Text>
      </View>
    </View>
  );
}
