import { View } from 'react-native';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { Text } from '../ui/text';
import { podiumVariants } from './leaderboard';

const LoadingLeaderboard: React.FC = () => {
  return (
    <View className="mt-2">
      <View className="flex-row items-end justify-center gap-4">
        <View className="flex flex-col flex-1 items-center">
          <View className="flex-row w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
            <View className="flex w-[96%] animate-pulse flex-col items-center gap-3 bg-gradient-to-t from-neutral-300/20 to-80% py-4 dark:from-neutral-300/10">
              <View className="flex flex-col items-center gap-1">
                <LucideIcon
                  name="Crown"
                  className={cn('size-6', podiumVariants({ text: 'silver' }))}
                />
                <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></View>
              </View>
              <View className="flex w-full flex-col items-center gap-0.5">
                <View className="mb-1 h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></View>
                <View className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></View>
              </View>
            </View>
          </View>
          <View className="flex-row w-full items-start justify-center bg-neutral-100 p-4 py-8 dark:bg-neutral-900/75">
            <View className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></View>
          </View>
        </View>
        <View className="flex flex-col flex-1 items-center">
          <View className="flex-row w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
            <View className="flex w-[96%] animate-pulse flex-col items-center gap-3 bg-gradient-to-t from-yellow-500/5 to-80% py-4 dark:from-yellow-500/10">
              <View className="flex flex-col items-center gap-1">
                <LucideIcon
                  name="Crown"
                  className={cn('size-6', podiumVariants({ text: 'gold' }))}
                />
                <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></View>
              </View>
              <View className="flex w-full flex-col items-center gap-0.5">
                <View className="mb-1 h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></View>
                <View className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></View>
              </View>
            </View>
          </View>
          <View className="flex-row w-full items-start justify-center bg-neutral-100 p-4 py-8 dark:bg-neutral-900/75 md:p-6 md:py-12">
            <View className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></View>
          </View>
        </View>
        <View className="flex flex-col flex-1 items-center">
          <View className="flex-row w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
            <View className="flex flex-col w-[96%] animate-pulse items-center gap-3 bg-gradient-to-t from-amber-700/5 to-80% py-4 dark:from-amber-700/10">
              <View className="flex flex-col items-center gap-1">
                <LucideIcon
                  name="Crown"
                  className={cn('size-6', podiumVariants({ text: 'bronze' }))}
                />
                {/* <CrownIcon className="mb-2 h-12 w-12 rounded-full text-2xl opacity-70 md:text-4xl" /> */}
                <View className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></View>
              </View>
              <View className="flex flex-col w-full items-center gap-0.5">
                <View className="mb-1 h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></View>
                <View className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></View>
              </View>
            </View>
          </View>
          <View className="flex-row w-full items-start justify-center bg-neutral-100 p-4 py-8 dark:bg-neutral-900/75">
            <View className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></View>
          </View>
        </View>
      </View>
    </View>
  );
};

const LoadingRows: React.FC = () => (
  <View className="animate-pulse divide-y divide-gray-200 dark:divide-gray-700">
    {[...Array(5)].map((_, index) => (
      <View key={index} className="flex-row items-center justify-between py-4">
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center justify-center gap-1">
            <Text className="text-xs text-neutral-400 dark:text-neutral-600">
              #
            </Text>
            <View className="h-4 w-3 rounded-full bg-gray-200 dark:bg-gray-700"></View>
          </View>
          <View className="size-12 rounded-full bg-gray-200 dark:bg-gray-700"></View>
          <View className="h-4 w-32 rounded-full bg-gray-200 dark:bg-gray-700"></View>
        </View>
        <View className="h-4 w-12 rounded-full bg-gray-200 dark:bg-gray-700"></View>
      </View>
    ))}
  </View>
);

export { LoadingLeaderboard, LoadingRows };
