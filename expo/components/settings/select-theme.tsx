import AsyncStorage from 'expo-sqlite/kv-store';
import { MoonStar, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Pressable, View } from 'react-native';

import { cn } from '~/lib/utils';
import { setAndroidNavigationBar } from '~/utils/android-navigation-bar';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export const SelectTheme = () => {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <View className="flex flex-row justify-between">
      <Text variant="h4">Tema</Text>
      <Pressable
        onPress={() => {
          const newTheme = colorScheme === 'dark' ? 'light' : 'dark';
          setColorScheme(newTheme);
          setAndroidNavigationBar(newTheme);
          AsyncStorage.setItem('theme', newTheme);
        }}
        className="web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2"
      >
        {({ pressed }) => (
          <View
            className={cn(
              'flex-1 aspect-square pt-0.5 justify-center items-start web:px-5',
              pressed && 'opacity-70',
            )}
          >
            {colorScheme === 'dark' ? (
              <Icon
                as={MoonStar}
                className="text-foreground"
                size={23}
                strokeWidth={1.25}
              />
            ) : (
              <Icon
                as={SunIcon}
                className="text-foreground"
                size={24}
                strokeWidth={1.25}
              />
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
};
