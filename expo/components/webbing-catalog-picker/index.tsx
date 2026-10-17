import type { WebbingPickerExperiment } from '~/features/growth/webbing-picker-layout';
import { ChevronDownIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { Icon } from '~/components/ui/icon';
import { Label } from '~/components/ui/label';
import { Text } from '~/components/ui/text';

import { LegacyModelImage } from './legacy-models';
import { selectionName, type WebbingModelSelection } from './model-selection';
import { PickerProvider, usePicker } from './picker-context';
import { PickerSheet } from './picker-sheet';

export type {
  LegacyWebbingModel,
  WebbingModelSelection,
} from './model-selection';

const translationKey = 'app.(modals).register-webbing.selectModel';

/**
 * Field that opens a sheet for choosing a SlackData model, a previously
 * available Choose Life model, or manual entry (`null`).
 */
export function WebbingCatalogPicker({
  labelId,
  value,
  onChange,
  experiment,
}: {
  labelId: string;
  value: WebbingModelSelection | null;
  onChange: (selection: WebbingModelSelection | null) => void;
  /** Layout experiment cohort; locked for each presentation of the sheet. */
  experiment: WebbingPickerExperiment;
}) {
  const { t } = useTranslation();
  return (
    <PickerProvider value={value} onChange={onChange} experiment={experiment}>
      <View className="gap-2 w-full">
        <Label nativeID={labelId}>{t(`${translationKey}.label`)}</Label>
        <PickerTrigger labelId={labelId} />
        <PickerSheet />
      </View>
    </PickerProvider>
  );
}

function PickerTrigger({ labelId }: { labelId: string }) {
  const { t } = useTranslation();
  const {
    state: { value },
    actions,
  } = usePicker();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabelledBy={labelId}
      onPress={actions.open}
      className="flex-row justify-between items-center px-4 py-3 rounded-md border border-input bg-background"
    >
      {value ? (
        <View className="flex-1 flex-row items-center gap-3">
          {value.source === 'legacy' ? (
            <LegacyModelImage model={value.model} size="sm" />
          ) : null}
          <Text className="flex-1 text-primary" numberOfLines={2}>
            {selectionName(value)}
          </Text>
        </View>
      ) : (
        <Text className="flex-1 text-muted-foreground">
          {t(`${translationKey}.placeholder`)}
        </Text>
      )}
      <Icon as={ChevronDownIcon} className="text-foreground" />
    </TouchableOpacity>
  );
}
