import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useHighline } from '~/hooks/use-highline';

import { Text } from '~/components/ui/text';

import { HighlineHistory } from './history';

export default function Info() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id });

  if (!highline) return null;

  return (
    <View className="flex-1 gap-6">
      {/* Title & Description */}
      <View className="gap-2">
        <Text className="text-3xl font-bold tracking-tight text-foreground">
          {highline.name}
        </Text>
        {highline.description ? (
          <Text className="text-base text-muted-foreground leading-relaxed">
            {highline.description}
          </Text>
        ) : null}
      </View>

      {/* Dimensions Card */}
      <HighlineDimensions height={highline.height} distance={highline.length} />
      
      {/* History */}
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
    <View className="bg-white rounded-2xl p-5 flex-row justify-evenly items-center">
      {/* Height */}
      <View className="flex items-center justify-center gap-1">
        <View className="flex-row items-baseline">
          <Text className="text-4xl font-bold text-foreground">{height}</Text>
          <Text className="text-xl font-semibold text-muted-foreground ml-0.5">
            m
          </Text>
        </View>
        <Text className="text-sm text-muted-foreground font-medium">
          {t('components.highline.info.height')}
        </Text>
      </View>

      {/* Divider */}
      <View className="bg-gray-200 w-px h-12" />

      {/* Length */}
      <View className="flex items-center justify-center gap-1">
        <View className="flex-row items-baseline">
          <Text className="text-4xl font-bold text-foreground">{distance}</Text>
          <Text className="text-xl font-semibold text-muted-foreground ml-0.5">
            m
          </Text>
        </View>
        <Text className="text-sm text-muted-foreground font-medium">
          {t('components.highline.info.length')}
        </Text>
      </View>
    </View>
  );
};
