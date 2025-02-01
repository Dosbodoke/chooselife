import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';

import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { H1, Lead } from '~/components/ui/typography';

import { HighlineHistory } from './history';

export default function Info() {
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: highline } = useQuery({
    queryKey: ['highline', id],
    queryFn: async () => {
      const result = await supabase.rpc('get_highline', {
        searchid: [id as string],
        userid: session?.user.id,
      });
      return result.data && result.data.length > 0 ? result.data[0] : null;
    },
    enabled: !!id,
  });

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
}> = ({ distance, height }) => (
  <Card>
    <CardContent className="flex flex-row justify-evenly items-center px-2 py-4 sm:gap-8">
      <View className="flex items-center justify-center gap-2">
        <View className="flex-row">
          <Text className="text-3xl font-extrabold">{height}</Text>
          <Text className="text-3xl font-extrabold text-muted-foreground">
            m
          </Text>
        </View>
        <Lead className="text-base">altura</Lead>
      </View>

      <View className="bg-gray-200 w-px h-full"></View>

      <View className="flex items-center justify-center gap-2">
        <View className="flex-row">
          <Text className="text-3xl font-extrabold">{distance}</Text>
          <Text className="text-3xl font-extrabold text-muted-foreground">
            m
          </Text>
        </View>
        <Lead className="text-base">comprimento</Lead>
      </View>
    </CardContent>
  </Card>
);
