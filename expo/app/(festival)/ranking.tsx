import { View } from 'react-native';

import { endDate, highlinesID, startDate } from '~/utils/festival-data';

import { Ranking } from '~/components/ranking';

export default function RankingPage() {
  return (
    <View className="p-4">
      <Ranking
        highlines_ids={highlinesID}
        startDate={startDate}
        endDate={endDate}
      />
    </View>
  );
}
