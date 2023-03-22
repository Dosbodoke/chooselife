import { View, Text } from 'react-native';
import React from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';

const FirstCadena = () => {
  return (
    <View className="flex flex-row gap-1">
      <Text className="text-gray-600">Primeira cadena por</Text>
      <TouchableOpacity>
        <Text className="font-bold text-blue-600">Thomaz</Text>
      </TouchableOpacity>
    </View>
  );
};

export default FirstCadena;
