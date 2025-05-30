import AsyncStorage from 'expo-sqlite/kv-store';
import { Pressable, View } from 'react-native';

import { MoonStar } from '~/lib/icons/MoonStar';
import { Sun } from '~/lib/icons/Sun';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';
import { setAndroidNavigationBar } from '~/utils/android-navigation-bar';

import { H4 } from '~/components/ui/typography';

export const SelectTheme = () => {
  const { isDarkColorScheme, setColorScheme } = useColorScheme();

  return (
    <View className="flex flex-row justify-between">
      <H4>Tema</H4>
      <Pressable
        onPress={() => {
          const newTheme = isDarkColorScheme ? 'light' : 'dark';
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
            {isDarkColorScheme ? (
              <MoonStar
                className="text-foreground"
                size={23}
                strokeWidth={1.25}
              />
            ) : (
              <Sun className="text-foreground" size={24} strokeWidth={1.25} />
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
};
