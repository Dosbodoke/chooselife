import { Link } from 'expo-router';
import { MessageSquare, Smile } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

const NewsCard = () => {
  return (
    <View className="bg-gray-100 rounded-lg p-4">
      <Text className="text-lg font-bold mb-2">News Title</Text>
      <Text className="text-gray-600">
        This is a brief description of the news article. Members can react and
        comment below.
      </Text>
      <View className="flex-row justify-between items-center mt-4">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <Smile className="w-4 h-4 text-gray-500" />
            <Text className="text-gray-500">12</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <Text className="text-gray-500">5</Text>
          </View>
        </View>
        <Link href="/(tabs)/organizations" asChild>
          <Text className="text-blue-500 font-bold">Join Discussion</Text>
        </Link>
      </View>
    </View>
  );
};

export const News = () => {
  return (
    <View className="gap-4">
      <NewsCard />
      <NewsCard />
    </View>
  );
};
