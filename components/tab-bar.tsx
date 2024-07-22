import { View, Pressable } from "react-native";
import React, { ReactNode, useEffect } from "react";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type {
  BottomTabBarProps,
  BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";

import { cn } from "~/lib/utils";

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  return (
    <View
      className="absolute bottom-6 left-0 right-0 shadow-sm w-fit"
      pointerEvents="box-none"
    >
      <View className="flex flex-row justify-between items-center bg-primary rounded-3xl mx-auto gap-12 p-4 px-11 pt-8 ">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          if (["_sitemap", "+not-found"].includes(route.name)) return null;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TabBarButton
              key={route.name}
              onPress={onPress}
              onLongPress={onLongPress}
              isFocused={isFocused}
              icon={
                options.tabBarIcon
                  ? options.tabBarIcon({
                      focused: isFocused,
                      color: "",
                      size: 16,
                    })
                  : null
              }
              label={label}
            />
          );
        })}
      </View>
    </View>
  );
};

export default TabBar;

const TabBarButton = ({
  isFocused,
  label,
  icon,
  onPress,
  onLongPress,
}: {
  isFocused: boolean;
  label: BottomTabNavigationOptions["tabBarLabel"];
  icon: ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(
      typeof isFocused === "boolean" ? (isFocused ? 1 : 0) : isFocused,
      { duration: 350 }
    );
  }, [scale, isFocused]);

  const animatedIconStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(scale.value, [0, 1], [1, 1.4]);
    const bottom = interpolate(scale.value, [0, 1], [0, 8]);

    return {
      transform: [{ scale: scaleValue }],
      bottom,
    };
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex gap-px justify-center items-center"
    >
      <Animated.View style={[animatedIconStyle]}>{icon}</Animated.View>
      <Animated.Text
        className={cn(
          "text-xs",
          isFocused ? "text-primary-foreground" : "text-muted-foreground"
        )}
      >
        {typeof label === "string" ? label : null}
      </Animated.Text>
    </Pressable>
  );
};
