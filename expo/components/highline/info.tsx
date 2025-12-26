import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useHighline } from '~/hooks/use-highline';

import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';

import { HighlineHistory } from './history';

export default function Info() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id });

  if (!highline) return null;

  return (
    <View className="flex-1 gap-4">
      <View>
        <Text variant="h1">{highline.name}</Text>
        {highline.description ? (
          <Text variant="lead">{highline.description}</Text>
        ) : null}
      </View>

      <HighlineDimensions height={highline.height} distance={highline.length} />
      <HighlineHistory highline={highline} />
    </View>
  );
}

const HighlineDimensions: React.FC<{
  distance: number;
  height: number;
}> = ({ distance, height }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex flex-row justify-evenly items-center sm:gap-8">
        <View className="flex items-center justify-center gap-2">
          <View className="flex-row">
            <Text className="text-3xl font-extrabold">{height}</Text>
            <Text className="text-3xl font-extrabold text-muted-foreground">
              m
            </Text>
          </View>
          <Text variant="lead" className="text-base">
            {t('components.highline.info.height')}
          </Text>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <View className="flex-row">
            <Text className="text-3xl font-extrabold">{distance}</Text>
            <Text className="text-3xl font-extrabold text-muted-foreground">
              m
            </Text>
          </View>
          <Text variant="lead" className="text-base">
            {t('components.highline.info.length')}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
};
