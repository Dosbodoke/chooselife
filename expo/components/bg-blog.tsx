import localImage from '~/assets/images/blurry-dark-blob.jpg';
import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Reanimated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BgBlob = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="relative flex-1 bg-black px-4"
      style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}
    >
      <Reanimated.View
        style={StyleSheet.absoluteFill}
        entering={FadeInUp.duration(1000)}
      >
        <ExpoImage
          source={localImage}
          style={StyleSheet.absoluteFill}
          blurRadius={50}
          contentFit="cover"
          contentPosition="center"
        />
      </Reanimated.View>
      {children}
    </View>
  );
};
