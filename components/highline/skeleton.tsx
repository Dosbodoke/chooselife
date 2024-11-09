import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "~/components/ui/skeleton";

const HighlineSkeleton = () => {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1">
      {/* Top buttons */}
      <View
        className="absolute px-4 flex-row justify-between w-full top-0 z-50"
        style={{
          paddingTop: insets.top,
        }}
      >
        <Skeleton className="size-10 rounded-full" />

        <View className="flex-row items-center justify-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
        </View>
      </View>

      {/* Image */}
      <View className="w-full h-96 bg-gray-500" />

      <View className="px-4 pt-4 gap-6 flex-1">
        {/* tabs */}
        <Skeleton className="w-full h-10 rounded-md" />
        {/* title */}
        <Skeleton className="w-5/6 h-12" />
        {/* description */}
        <View className="gap-1">
          <Skeleton className="w-3/4 h-4" />
          <Skeleton className="w-2/5 h-4" />
        </View>
      </View>
    </View>
  );
};

export { HighlineSkeleton };
