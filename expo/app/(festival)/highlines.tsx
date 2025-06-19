import { SafeAreaView, ScrollView, View } from 'react-native';

import { useHighline } from '~/hooks/use-highline';
import { highlinesID } from '~/utils/festival-data';

import { HighlineMapCard } from '~/components/map/map-card';

export default function HighlinesPage() {
  const { highlines } = useHighline({});

  const festivalHighlines = highlines
    .filter((high) => highlinesID.includes(high.id))
    .map((high) => ({ ...high, status: 'rigged' })); // Temporary solution because I have it with rig_date and is_rigged true on the DB and the status is still unrigged.

  return (
    <SafeAreaView className="flex-1 pt-6">
      <ScrollView className="bg-gray-50">
        <View className="px-4 pt-6 gap-4">
          {festivalHighlines.map((high) => (
            <HighlineMapCard
              key={high.id}
              highline={high}
              isFocused={false}
              onPress={() => {}}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
