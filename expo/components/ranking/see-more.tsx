import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { Text } from '../ui/text';

interface Props {
  onPress: () => void;
  disabled?: boolean;
}
function SeeMore({ onPress, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} className="mt-2">
      <Text className="text-sm font-medium text-blue-600 dark:text-blue-500">
        {t('components.ranking.see-more')}
      </Text>
    </TouchableOpacity>
  );
}

export default SeeMore;
