import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import React from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';

import { RankingPodium } from '@src/components';

const Comments = () => {
  return (
    <View>
      <View className="flex flex-row items-end justify-between">
        <Text className="text-xl font-bold">Ranking</Text>
        <TouchableOpacity>
          <Text className="text-blue-500">ver ranking</Text>
        </TouchableOpacity>
      </View>
      <View className="mt-3 flex flex-row justify-evenly">
        <RankingPodium
          name="Juan Andrade"
          position={2}
          profilePic="https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg"
          score="800"
        />
        <RankingPodium
          name="Juan Andrade"
          position={1}
          profilePic="https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg"
          score="900"
        />
        <RankingPodium
          name="Carlos Henrique"
          position={3}
          profilePic="https://naturalextremo.com/wp-content/uploads/2020/01/Virada-Esportiva-Highline-Natural-Extremo-@angelomaragno-@naturalextremobrasil-14-e1589735926438.jpg"
          score="540"
        />
      </View>
    </View>
  );
};

export default Comments;
