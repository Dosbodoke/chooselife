import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { getR2PublicUrl } from '~/lib/r2';
import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';
import { CatalogAttribution } from '~/components/webbing-catalog-specs';

import { GRID_GAP, useGridItemWidth } from './grid';
import type { LegacyWebbingModel } from './model-selection';
import { usePicker } from './picker-context';

const translationKey = 'app.(modals).register-webbing.selectModel';

export function LegacyModelImage({
  model,
  size,
}: {
  model: LegacyWebbingModel;
  size: 'sm' | 'lg';
}) {
  if (!model.image_url) return null;
  return (
    <View
      className={cn(
        'relative overflow-hidden border border-border bg-muted',
        size === 'sm' ? 'h-10 w-10 rounded-lg' : 'h-20 w-20 rounded-xl',
      )}
    >
      <Image
        source={{ uri: getR2PublicUrl('webbings', model.image_url) }}
        contentFit="cover"
        alt={model.name}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

/** List footer: SlackData credit, then the previously available models. */
export function LegacyModels() {
  const { t } = useTranslation();
  const {
    meta: { catalog },
  } = usePicker();

  return (
    <View className="gap-3 pt-6 pb-20">
      {catalog.data ? <CatalogAttribution /> : null}
      <Text className="text-base font-semibold text-foreground">
        {t(`${translationKey}.legacyTitle`)}
      </Text>
      <LegacyModelGrid />
    </View>
  );
}

function LegacyModelGrid() {
  const { t } = useTranslation();
  const {
    state: { legacyItems },
    meta: { legacy },
  } = usePicker();

  if (legacy.isError) {
    return (
      <Text className="text-sm text-muted-foreground">
        {t(`${translationKey}.legacyUnavailable`)}
      </Text>
    );
  }
  if (legacy.isPending) return <ActivityIndicator />;
  return (
    <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
      {legacyItems.map((model) => (
        <LegacyModelCard key={model.id} model={model} />
      ))}
    </View>
  );
}

function LegacyModelCard({ model }: { model: LegacyWebbingModel }) {
  const { t } = useTranslation();
  const width = useGridItemWidth();
  const {
    state: { value },
    actions,
  } = usePicker();
  const isSelected = value?.source === 'legacy' && value.model.id === model.id;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={t(`${translationKey}.selectModelFor`, {
        name: model.name,
      })}
      onPress={() => actions.selectLegacy(model)}
      style={{ width }}
      className={cn(
        'items-start justify-center gap-1 p-4 rounded-2xl border',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-muted/30',
      )}
    >
      {model.image_url && (
        <View className="mb-2">
          <LegacyModelImage model={model} size="lg" />
        </View>
      )}
      <Text className="text-sm font-semibold text-foreground">
        {model.name}
      </Text>
      <Text className="text-xs capitalize text-muted-foreground">
        {model.material} · {model.weave}
      </Text>
    </TouchableOpacity>
  );
}
