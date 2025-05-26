import { View } from 'react-native';

import { Ranking } from '~/components/ranking';
import { Text } from '~/components/ui/text';

const highline_ids = [
  '162394aa-0653-4b6f-b78a-612bb2697a03',
  '636b62f3-872f-4e18-9df2-3e9645606d62',
];

export default function RankingPage() {
  return (
    <View className="p-4">
      <Ranking highlines_ids={highline_ids} />
    </View>
  );
}
