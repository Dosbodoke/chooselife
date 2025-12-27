import { MapIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '~/components/ui/icon';

interface MapToggleProps {
  onPress: () => void;
}

export const MapToggle: React.FC<MapToggleProps> = ({ onPress }) => {
  const { t } = useTranslation();

  return (
    <View className="absolute bottom-20 w-full items-center">
      <TouchableOpacity
        onPress={onPress}
        className="bg-primary py-2 px-6 rounded-3xl flex gap-2 flex-row items-center"
      >
        <Text className="text-primary-foreground font-medium">
          {t('components.map.bottom-sheet.map')}
        </Text>
        <Icon as={MapIcon} className="h-6 w-6 text-primary-foreground" />
      </TouchableOpacity>
    </View>
  );
};
