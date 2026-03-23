import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Skeleton } from '~/components/ui/skeleton';

export function OrganizationLoadingState() {
  return (
    <SafeAreaView className="h-full w-full bg-gray-100">
      <View className="flex-1 py-8 px-4 gap-6">
        {/* Header Group */}
        <View className="bg-white rounded-xl p-4 gap-3">
          <Skeleton className="h-6 w-40 rounded bg-gray-200" />
          <Skeleton className="h-4 w-56 rounded bg-gray-200" />
          <Skeleton className="h-4 w-full rounded bg-gray-200 mt-2" />
          <Skeleton className="h-4 w-3/4 rounded bg-gray-200" />
        </View>

        {/* Stats Group */}
        <View className="bg-white rounded-xl p-4 gap-3">
          <Skeleton className="h-10 w-full rounded bg-gray-200" />
          <Skeleton className="h-10 w-full rounded bg-gray-200" />
        </View>

        {/* Membership Section */}
        <Skeleton className="h-48 w-full rounded-xl bg-gray-200" />

        {/* Activities */}
        <Skeleton className="h-32 w-full rounded-xl bg-gray-200" />
      </View>
    </SafeAreaView>
  );
}
