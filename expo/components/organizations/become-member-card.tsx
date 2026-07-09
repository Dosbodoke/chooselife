import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import SlacCabeMaisImage from '~/assets/images/slac-cabe-mais.png';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

type BecomeMemberCardProps = {
  onPress: () => void;
};

export function BecomeMemberCard({ onPress }: BecomeMemberCardProps) {
  return (
    <View
      className="relative min-h-[200px] justify-end gap-4 overflow-hidden rounded-xl bg-zinc-900 p-6"
      style={{ borderCurve: 'continuous' }}
    >
      {/* Spotlight */}
      <View
        className="absolute left-0 top-0 h-full w-full"
        style={{
          experimental_backgroundImage:
            'radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.6) 0%, rgba(24, 24, 27, 0) 60%)',
        }}
      />

      <Image
        source={SlacCabeMaisImage}
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 250,
          height: 250,
          transform: [{ rotate: '25deg' }],
          opacity: 0.4,
        }}
        contentFit="contain"
      />

      {/* Gradient for text readability */}
      <View
        className="absolute inset-0"
        style={{
          experimental_backgroundImage:
            'linear-gradient(to top, rgba(24, 24, 27, 1) 10%, rgba(24, 24, 27, 0.4) 100%)',
        }}
      />

      <View className="z-10 gap-2">
        <Text className="text-2xl font-black text-white">Torne-se um membro</Text>
        <Text className="text-base font-medium leading-6 text-zinc-400">
          Junte-se a nós e apoie o desenvolvimento do slackline no Cerrado.
        </Text>
      </View>

      <Button
        onPress={onPress}
        className="w-full bg-white active:bg-gray-100 active:scale-[0.98]"
      >
        <Text className="font-bold text-black">Seja Membro</Text>
      </Button>
    </View>
  );
}
