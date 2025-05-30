import { SafeAreaView, ScrollView, View } from 'react-native';

import { endDate, highlinesID, startDate } from '~/utils/festival-data';

import { Ranking } from '~/components/ranking';

export default function RankingPage() {
  return (
    <SafeAreaView className="flex-1 pt-6">
      <ScrollView className="bg-gray-50">
        <View className="px-4 pt-6 gap-4">
          <Ranking
            highlines_ids={highlinesID}
            endDate={endDate}
            startDate={startDate}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
