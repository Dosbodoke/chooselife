import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useHighline } from '~/hooks/use-highline';

import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { H1, Lead } from '~/components/ui/typography';

import { HighlineHistory } from './history';

export default function Info() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id });

  if (!highline) return null;

  return (
    <View className="flex-1 gap-4">
      <View>
        <H1>{highline.name}</H1>
        {highline.description ? <Lead>{highline.description}</Lead> : null}
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
      <CardContent className="flex flex-row justify-evenly items-center px-2 py-4 sm:gap-8">
        <View className="flex items-center justify-center gap-2">
          <View className="flex-row">
            <Text className="text-3xl font-extrabold">{height}</Text>
            <Text className="text-3xl font-extrabold text-muted-foreground">
              m
            </Text>
          </View>
          <Lead className="text-base">
            {t('components.highline.info.height')}
          </Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <View className="flex-row">
            <Text className="text-3xl font-extrabold">{distance}</Text>
            <Text className="text-3xl font-extrabold text-muted-foreground">
              m
            </Text>
          </View>
          <Lead className="text-base">
            {t('components.highline.info.length')}
          </Lead>
        </View>
      </CardContent>
    </Card>
  );
};
