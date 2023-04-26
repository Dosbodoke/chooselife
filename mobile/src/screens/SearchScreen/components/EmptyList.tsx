import { View, Text } from 'react-native';
import React from 'react';

const EmptyList = () => {
  return (
    <View className="flex h-48 flex-col items-center justify-center">
      <Text className="text-lg font-bold">Nenhum Highline {`\uD83D\uDE22`}</Text>
      <Text className="text-sm text-gray-500">Que pena que você não encontrou o que queria</Text>
    </View>
  );
};

export default EmptyList;
