import { Stack } from 'expo-router';
import { Mountain } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '~/components/ui/text';

export function OrganizationErrorState() {
  return (
    <>
      <Stack.Screen options={{ title: 'Erro' }} />
      <SafeAreaView className="h-full w-full">
        <View className="flex-1 bg-white justify-center items-center px-6">
          <Mountain className="text-gray-300 mb-4" size={64} />
          <Text className="text-gray-900 text-2xl font-bold mb-2">
            Erro ao carregar
          </Text>
          <Text className="text-gray-600 text-center">
            Houve um erro ao carregar as informações da associação.
          </Text>
        </View>
      </SafeAreaView>
    </>
  );
}