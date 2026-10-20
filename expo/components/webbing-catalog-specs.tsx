import {
  isSafeExternalUrl,
  SLACKDATA_LICENSE_URL,
  SLACKDATA_SITE_URL,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';
import { AlertTriangleIcon, ExternalLinkIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { openExternal } from '~/lib/open-external';
import { cn } from '~/lib/utils';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
} from '~/components/ui/alert';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const translationKey = 'app.(modals).register-webbing.catalog';
const specsKey = 'components.webbing-detail.specifications';
const warningsKey = 'components.webbing-detail.warnings';

/**
 * SlackData credit and license links, required wherever its data shows.
 * Product photos have their own owners, so they get a separate credit.
 */
export function CatalogAttribution({
  className,
  showPhotoCredit = false,
}: {
  className?: string;
  showPhotoCredit?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className={cn('gap-1', className)}>
      <Text className="text-xs text-muted-foreground">
        {t(`${translationKey}.attribution`)}.{' '}
        {t(`${translationKey}.normalized`)}
      </Text>
      {showPhotoCredit ? (
        <Text className="text-xs text-muted-foreground">
          {t(`${translationKey}.photoCredit`)}
        </Text>
      ) : null}
      <View className="flex-row gap-4">
        <AttributionLink url={SLACKDATA_SITE_URL}>
          {t(`${translationKey}.site`)}
        </AttributionLink>
        <AttributionLink url={SLACKDATA_LICENSE_URL}>
          {t(`${translationKey}.license`)}
        </AttributionLink>
      </View>
    </View>
  );
}

function AttributionLink({ url, children }: { url: string; children: string }) {
  return (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={() => openExternal(url)}
      className="min-h-8 justify-center"
    >
      <Text className="text-xs font-medium text-blue-700 underline">
        {children}
      </Text>
    </TouchableOpacity>
  );
}

export function SelectedCatalogDetails({
  snapshot,
}: {
  snapshot: WebbingCatalogSnapshot;
}) {
  return (
    <View className="gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <CatalogSpecs snapshot={snapshot} />
      <CatalogAttribution />
    </View>
  );
}

/** Normalized SlackData fields; unknown values are labelled, never guessed. */
export function CatalogSpecs({
  snapshot,
}: {
  snapshot: WebbingCatalogSnapshot;
}) {
  return (
    <View className="gap-3">
      <CatalogWarnings snapshot={snapshot} />
      <CatalogSpecRows snapshot={snapshot} />
      {isSafeExternalUrl(snapshot.productUrl) && (
        <ProductPageLink url={snapshot.productUrl} />
      )}
    </View>
  );
}

function CatalogWarnings({ snapshot }: { snapshot: WebbingCatalogSnapshot }) {
  const { t } = useTranslation();
  const notForHighlineSource = snapshot.manufacturerNotForHighlineSource;
  return (
    <>
      {snapshot.manufacturerNotForHighline === true && (
        <Alert variant="destructive">
          <AlertIcon icon={AlertTriangleIcon} />
          <AlertContent>
            <AlertDescription>
              {t(`${warningsKey}.notForHighline`)}
              {notForHighlineSource
                ? `\n${t(`${warningsKey}.notForHighlineSource`, {
                    source: notForHighlineSource,
                  })}`
                : ''}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {snapshot.isaWarning && (
        <Alert variant="warning">
          <AlertIcon icon={AlertTriangleIcon} />
          <AlertContent>
            <AlertDescription>
              {t(`${warningsKey}.isaWarning`)}: {snapshot.isaWarning}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </>
  );
}

function CatalogSpecRows({ snapshot }: { snapshot: WebbingCatalogSnapshot }) {
  const { t } = useTranslation();
  const unknown = t(`${specsKey}.notRecorded`);
  const yesNo = (value: boolean | null) =>
    value === null ? unknown : t(`${specsKey}.${value ? 'yes' : 'no'}`);
  const measure = (
    value: number | null,
    unit: 'mm' | 'gramsPerMeter' | 'kn',
  ) => (value === null ? unknown : t(`${specsKey}.${unit}`, { value }));
  const stretch = snapshot.stretch?.length
    ? snapshot.stretch
        .map((point) => t(`${specsKey}.stretchAt`, point))
        .join(', ')
    : unknown;
  const status =
    snapshot.active === null
      ? unknown
      : t(`${specsKey}.${snapshot.active ? 'active' : 'discontinued'}`);

  const rows: [string, string][] = [
    [t(`${specsKey}.materials`), snapshot.materials?.join(' / ') ?? unknown],
    [t(`${specsKey}.construction`), snapshot.construction ?? unknown],
    [t(`${specsKey}.width`), measure(snapshot.widthMm, 'mm')],
    [t(`${specsKey}.thickness`), measure(snapshot.thicknessMm, 'mm')],
    [
      t(`${specsKey}.weight`),
      measure(snapshot.weightGramsPerMeter, 'gramsPerMeter'),
    ],
    [
      t(`${specsKey}.breakingStrength`),
      measure(snapshot.breakingStrengthKn, 'kn'),
    ],
    [t(`${specsKey}.stretch`), stretch],
    [t(`${specsKey}.isaCertified`), yesNo(snapshot.isaCertified)],
    [t(`${specsKey}.isaClass`), snapshot.isaClass ?? unknown],
    [t(`${specsKey}.status`), status],
  ];
  if (snapshot.isaCertificate) {
    rows.push([t(`${specsKey}.isaCertificate`), snapshot.isaCertificate]);
  }

  return (
    <View className="gap-1.5">
      {rows.map(([label, value]) => (
        <View key={label} className="flex-row justify-between gap-3">
          <Text className="text-xs text-muted-foreground">{label}</Text>
          <Text className="flex-1 text-xs font-medium text-right text-foreground">
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ProductPageLink({ url }: { url: string }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      accessibilityRole="link"
      onPress={() => openExternal(url)}
      className="flex-row items-center gap-1.5 min-h-8"
    >
      <Icon as={ExternalLinkIcon} size={14} className="text-blue-700" />
      <Text className="text-xs font-medium text-blue-700">
        {t(`${specsKey}.productPage`)}
      </Text>
    </TouchableOpacity>
  );
}
