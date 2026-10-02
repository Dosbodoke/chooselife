import type { RigStatuses } from '@chooselife/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { Highline } from '~/hooks/use-highline';

import { Text } from '~/components/ui/text';

import { HighlineHistory } from './history';
import { LocationWeatherCard } from './location-weather-card';
import { WhatsAppGroupLink } from './whatsapp-group-link';

/** Name, description and dimensions; shown above the page's tabs. */
export const HighlineSummary: React.FC<{ highline: Highline }> = ({
  highline,
}) => (
  <View className="gap-6">
    <View className="gap-2">
      <Text className="text-3xl font-bold tracking-tight text-foreground">
        {highline.name}
      </Text>
      {highline.description ? (
        <Text className="text-base text-muted-foreground leading-relaxed">
          {highline.description}
        </Text>
      ) : null}
      {highline.whatsapp_group_url ? (
        <WhatsAppGroupLink url={highline.whatsapp_group_url} />
      ) : null}
    </View>

    <HighlineDimensions height={highline.height} distance={highline.length} />
  </View>
);

/** Content of the "Details" tab. */
export const HighlineDetails: React.FC<{ highline: Highline }> = ({
  highline,
}) => (
  <View className="gap-6">
    <LocationWeatherCard
      hasLocation={!!highline.anchor_a_lat}
      latitude={highline.anchor_a_lat ?? undefined}
      longitude={highline.anchor_a_long ?? undefined}
      anchorB={
        highline.anchor_b_lat && highline.anchor_b_long
          ? [highline.anchor_b_long, highline.anchor_b_lat]
          : undefined
      }
      name={highline.name}
      status={(highline.status as RigStatuses | null) ?? null}
    />

    <HighlineHistory highline={highline} />
  </View>
);

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
