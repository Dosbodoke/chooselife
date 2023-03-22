import { View, Text, Image } from 'react-native';
import React from 'react';
import { GoldenCrownSvg } from '@src/assets';

interface Props {
  position: 1 | 2 | 3;
  name: string;
  profilePic: string;
  score: string;
}

const RankingPodium = ({ position, name, profilePic, score }: Props) => {
  function renderImage() {
    const color = position === 1 ? '#FFD700' : position === 2 ? '#C0C0C0' : '#CD7F32';
    const size = position === 1 ? 'h-24 w-24' : 'h-20 w-20';

    return (
      <View className={`relative mb-3 ${size}`}>
        <Image
          className="h-full w-full rounded-full object-contain"
          style={{ borderWidth: 2, borderColor: color }}
          source={{
            uri: profilePic,
          }}
        />
        <View pointerEvents="none" className="absolute -bottom-2 flex w-full items-center">
          <View
            className="flex h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: color }}>
            <Text className="font-bold">{position}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={`flex items-center ${position !== 1 ? 'mt-20 self-end' : ''}`}>
      {position === 1 && <GoldenCrownSvg />}
      {renderImage()}
      <Text className="font-bold">{name}</Text>
      <Text className="text-slate-400">{score}</Text>
    </View>
  );
};

export default RankingPodium;
