import AsyncStorage from "@react-native-async-storage/async-storage";
import { View } from "react-native";

import { useColorScheme } from "~/lib/useColorScheme";
import { setAndroidNavigationBar } from "~/lib/android-navigation-bar";

import { Switch } from "~/components/ui/switch";
import { H4 } from "~/components/ui/typography";

export const SelectTheme = () => {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <View className="flex flex-row justify-between">
      <H4>Modo escuro</H4>
      <Switch
        checked={colorScheme === "dark"}
        onCheckedChange={(checked) => {
          const newTheme = checked ? "dark" : "light";
          setColorScheme(newTheme);
          setAndroidNavigationBar(newTheme);
          AsyncStorage.setItem("theme", newTheme);
        }}
      />
    </View>
  );
};
