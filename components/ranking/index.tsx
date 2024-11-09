import React from "react";
import { useLocalSearchParams } from "expo-router";

import { CategoryDropdown } from "./category-dropdown";
import { Cadenas, Distance, FullLine, Speedline } from "./categories";
import { View } from "react-native";

interface Props {
  highlines_ids: string[];
  visibleCategories?: Category[];
  startDate?: Date;
  endDate?: Date;
}

export type Category = "speedline" | "distance" | "cadenas" | "fullLine";

const CategoryRenderer: React.FC<
  Props & {
    category: Category;
  }
> = ({ category, highlines_ids, visibleCategories, startDate, endDate }) => {
  if (!visibleCategories?.includes(category)) return null;
  switch (category) {
    case "speedline":
      return <Speedline highline_id={highlines_ids[0]} />;
    case "distance":
      return (
        <Distance
          highlines_ids={highlines_ids}
          startDate={startDate}
          endDate={endDate}
        />
      );
    case "cadenas":
      return (
        <Cadenas
          highlines_ids={highlines_ids}
          startDate={startDate}
          endDate={endDate}
        />
      );
    case "fullLine":
      return (
        <FullLine
          highlines_ids={highlines_ids}
          startDate={startDate}
          endDate={endDate}
        />
      );
    default:
      return null;
  }
};

export const Ranking: React.FC<Props> = ({
  highlines_ids,
  visibleCategories = ["cadenas", "distance", "fullLine", "speedline"], // All categories visible by default,
  startDate,
  endDate,
}) => {
  const { category } = useLocalSearchParams<{ category: Category }>();
  const selectedCategory = category || "distance";

  return (
    <View className="w-full rounded-lg">
      <CategoryDropdown
        selectedCategory={selectedCategory}
        visibleCategories={visibleCategories}
      />
      <CategoryRenderer
        category={selectedCategory}
        highlines_ids={highlines_ids}
        visibleCategories={visibleCategories}
        startDate={startDate}
        endDate={endDate}
      />
    </View>
  );
};
