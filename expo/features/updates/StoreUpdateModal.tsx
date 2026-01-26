import { Image } from 'expo-image';
import { ShieldCheck } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '~/components/ui/icon';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

import { IconGridBackground } from './components/IconGridBackground';
import { useUpdate } from './UpdateProvider';

export function StoreUpdateModal() {
  const { store } = useUpdate();
  const { top, bottom } = useSafeAreaInsets();
  const { storeUpdateRequired, openStore, triggerAndroidUpdate } = store;

  // On Android, trigger native in-app update when store update is required
  useEffect(() => {
    if (storeUpdateRequired && Platform.OS === 'android') {
      triggerAndroidUpdate();
    }
  }, [storeUpdateRequired, triggerAndroidUpdate]);

  // On Android, we don't show a custom modal - the native UI handles it
  // If the native update fails, the triggerAndroidUpdate will fall back to opening the store
  if (Platform.OS === 'android') {
    return null;
  }

  return (
    <Modal
      visible={storeUpdateRequired}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent closing with back button
      }}
    >
      <View
        testID="store-update-modal"
        className="flex-1 bg-background items-center justify-center px-6"
        style={{ paddingTop: top, paddingBottom: bottom }}
      >
        <IconGridBackground rows={8} cols={7} />
        <StoreUpdateContent onUpdate={openStore} />
      </View>
    </Modal>
  );
}

function StoreUpdateContent({ onUpdate }: { onUpdate: () => void }) {
  const { t } = useTranslation();

  const iconScale = useSharedValue(0.7);
  const iconOpacity = useSharedValue(0);

  useEffect(() => {
    iconScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    iconOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  return (
    <View className="items-center gap-6 max-w-sm w-full">
      <View className="items-center justify-center">
        <Animated.View
          className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg"
          style={iconAnimStyle}
        >
          <Image
            source={require('~/assets/icons/adaptive-icon.png')}
            style={{ width: 96, height: 96 }}
            contentFit="cover"
          />
        </Animated.View>
        <Animated.View
          className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#44c6b1] items-center justify-center border-2 border-white"
          style={iconAnimStyle}
        >
          <Icon as={ShieldCheck} size={16} className="text-white" />
        </Animated.View>
      </View>

      <Animated.View
        className="items-center gap-3"
        entering={FadeInDown.delay(200).springify().damping(80).stiffness(200)}
      >
        <Text testID="store-update-title" className="text-3xl font-bold text-center">
          {t('updates.store.title')}
        </Text>
        <Text className="text-lg text-muted-foreground text-center">
          {t('updates.store.description')}
        </Text>
      </Animated.View>

      <Animated.View
        className="w-full"
        entering={FadeInDown.delay(400).springify()}
      >
        <Button
          testID="store-update-btn"
          onPress={onUpdate}
          className="w-full"
          size="lg"
          style={{ backgroundColor: '#44c6b1' }}
        >
          <Text className="text-white font-semibold">{t('updates.store.updateNow')}</Text>
        </Button>
      </Animated.View>
    </View>
  );
}
