import GuideCover from '~/assets/images/highline-beginner-guide-cover.jpg';
import { Image } from 'expo-image';
import { View } from 'react-native';

export function CourseGuideCover() {
  return (
    <View
      className="flex-1 items-center bg-[#d8d6cf] px-4 pb-40 pt-5"
      pointerEvents="none"
    >
      <View
        className="h-full w-full max-w-sm"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.16)' }}
      >
        <Image
          accessibilityLabel="Capa do Guia da Universidade do Highline"
          source={GuideCover}
          contentFit="contain"
          style={{ height: '100%', width: '100%' }}
        />
      </View>
    </View>
  );
}
