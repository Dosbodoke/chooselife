import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '~/components/ui/icon';
import { Button } from '~/components/ui/button';
import { Progress } from '~/components/ui/progress';
import { Text } from '~/components/ui/text';

import { IconGridBackground } from './components/IconGridBackground';
import { useUpdate } from './UpdateProvider';

const styles = StyleSheet.create({
  bottomSheet: {
    marginHorizontal: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: {
      width: 1,
      height: 1,
    },
  },
});

export function UpdatePrompt() {
  const { t } = useTranslation();
  const { ota } = useUpdate();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const {
    showPrompt,
    isDownloading,
    downloadProgress,
    error,
    downloadAndApply,
    downloadInBackground,
    checkForUpdates,
  } = ota;

  useEffect(() => {
    if (showPrompt) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.close();
    }
  }, [showPrompt]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="none" />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      enablePanDownToClose={false}
      detached={true}
      bottomInset={46}
      style={styles.bottomSheet}
    >
      <BottomSheetView className="relative overflow-hidden p-6 items-center gap-5">
        <IconGridBackground rows={4} cols={7} />
        {error ? (
          <ErrorContent
            onRetry={checkForUpdates}
            onDismiss={downloadInBackground}
            isLoading={ota.isChecking}
          />
        ) : isDownloading ? (
          <DownloadingContent progress={downloadProgress} />
        ) : (
          <UpdateAvailableContent
            onUpdate={downloadAndApply}
            onLater={downloadInBackground}
            isLoading={isDownloading}
          />
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function UpdateAvailableContent({
  onUpdate,
  onLater,
  isLoading,
}: {
  onUpdate: () => void;
  onLater: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  const iconScale = useSharedValue(0.85);
  const iconOpacity = useSharedValue(0);
  const sparkleOpacity = useSharedValue(0);
  const sparkleRotation = useSharedValue(0);

  useEffect(() => {
    iconScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    iconOpacity.value = withTiming(1, { duration: 300 });
    sparkleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    sparkleRotation.value = withDelay(300, withTiming(20, { duration: 600 }));
  }, []);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const sparkleAnimStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
    transform: [{ rotate: `${sparkleRotation.value}deg` }],
  }));

  return (
    <>
      <View className="items-center justify-center">
        <Animated.View
          className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center"
          style={iconAnimStyle}
        >
          <Icon as={ShieldCheck} className="text-primary" size={32} />
        </Animated.View>
        <Animated.View className="absolute -top-1 -right-1" style={sparkleAnimStyle}>
          <Icon as={Sparkles} size={16} color="#44c6b1" />
        </Animated.View>
      </View>
      <Text testID="ota-update-title" className="text-2xl font-bold text-center">
        {t('updates.ota.title')}
      </Text>
      <Text className="text-muted-foreground text-center">{t('updates.ota.description')}</Text>
      <Button testID="ota-update-now-btn" onPress={onUpdate} disabled={isLoading} className="w-full">
        <Text>{t('updates.ota.updateNow')}</Text>
      </Button>
      <Button
        testID="ota-remind-later-btn"
        variant="outline"
        onPress={onLater}
        disabled={isLoading}
        className="w-full"
      >
        <Text>{t('updates.ota.updateLater')}</Text>
      </Button>
    </>
  );
}

function DownloadingContent({ progress }: { progress: number }) {
  const { t } = useTranslation();

  const pulseScale = useSharedValue(1);
  const lastMilestone = useRef(0);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (progress >= milestone && lastMilestone.current < milestone) {
        lastMilestone.current = milestone;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      }
    }
  }, [progress]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <>
      <Animated.View
        className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center"
        style={pulseStyle}
      >
        <Icon as={ShieldCheck} className="text-primary" size={32} testID="ota-downloading-spinner" />
      </Animated.View>
      <Text testID="ota-downloading-title" className="text-xl font-bold text-center">
        {t('updates.ota.downloading')}
      </Text>
      <View className="w-full gap-2">
        <Progress
          testID="ota-download-progress"
          value={progress}
          className="w-full"
          indicatorClassName="bg-[#44c6b1]"
        />
        <Text className="text-sm text-muted-foreground text-center">{Math.round(progress)}%</Text>
      </View>
    </>
  );
}

function ErrorContent({
  onRetry,
  onDismiss,
  isLoading,
}: {
  onRetry: () => void;
  onDismiss: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  const shakeX = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(8, { duration: 80 }),
      withTiming(-8, { duration: 80 }),
      withTiming(6, { duration: 80 }),
      withTiming(-6, { duration: 80 }),
      withTiming(0, { duration: 80 })
    );
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <>
      <Animated.View
        className="w-16 h-16 bg-destructive/10 rounded-full items-center justify-center"
        style={shakeStyle}
      >
        <Icon as={AlertTriangle} className="text-destructive" size={32} />
      </Animated.View>
      <Text testID="ota-error-title" className="text-2xl font-bold text-center">
        {t('updates.ota.errorTitle')}
      </Text>
      <Text className="text-muted-foreground text-center">{t('updates.ota.errorDescription')}</Text>
      <Button testID="ota-retry-btn" onPress={onRetry} disabled={isLoading} className="w-full">
        <Text>{t('updates.ota.retry')}</Text>
      </Button>
      <Button
        testID="ota-error-dismiss-btn"
        variant="outline"
        onPress={onDismiss}
        disabled={isLoading}
        className="w-full"
      >
        <Text>{t('updates.ota.updateLater')}</Text>
      </Button>
    </>
  );
}
