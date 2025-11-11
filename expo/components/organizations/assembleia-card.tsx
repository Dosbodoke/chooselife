import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';

import { LucideIcon } from '~/lib/icons/lucide-icon';

import { Text } from '~/components/ui/text';

import { Card, CardContent } from '../ui/card';

export const AssembleiaCard = () => {
  return (
    <Card className="overflow-hidden">
      <Image
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.4,
        }}
        source={{
          uri: 'https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/images/heroui-native-example/home-components-light.png',
        }}
        contentFit="cover"
      />
      <CardContent className="flex-row gap-4">
        <View
          className="rounded-xl overflow-hidden w-12 h-12 items-center justify-center"
          style={{
            experimental_backgroundImage:
              'linear-gradient(135deg, #6366f1, #4f46e5)',
          }}
        >
          <LucideIcon name="Calendar" className="text-white" />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-black text-gray-900">
            Próxima Assembleia
          </Text>
          <Text className="text-base font-medium text-gray-600 leading-6 mb-3">
            As Assembleias Gerais Ordinárias são realizadas semestralmente,
            preferencialmente no segundo mês de cada semestre.
          </Text>
          <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <Text className="text-sm text-blue-800 font-semibold">
              💡 Somente membros podem participar das assembleias e usufruir dos
              benefícios
            </Text>
          </View>
        </View>
      </CardContent>
    </Card>
  );
};
