import { Button, Host, HStack, Image, Text } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { MapToggle as BaseMapToggle } from './map-toggle-button';

interface MapToggleProps {
  onPress: () => void;
}

export const MapToggle: React.FC<MapToggleProps> = ({ onPress }) => {
  const { t } = useTranslation();

  if (!isLiquidGlassAvailable()) {
    return <BaseMapToggle onPress={onPress} />;
  }

  return (
    <View className="absolute bottom-20 w-full items-center">
      <Host matchContents>
        <Button onPress={onPress} variant="glass" role="default">
          <HStack
            alignment="center"
            spacing={8}
            modifiers={[
              frame({ minHeight: 32, minWidth: 96 }),
            ]}
          >
            <Text color="white" weight="medium">
              {t('components.map.bottom-sheet.map')}
            </Text>
            <Image
              systemName="map"
              size={18}
              color="white"
              modifiers={[frame({ width: 24, height: 24 })]}
            />
          </HStack>
        </Button>
      </Host>
    </View>
  );
};
