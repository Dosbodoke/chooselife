import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useQueryClient } from '@tanstack/react-query';
import { removeStagedHighlineImage } from '~/features/highline-registration/image-storage';
import type { QueuedHighlineSubmission } from '~/features/highline-registration/state/model';
import {
  selectNeedsAttentionSubmissions,
  selectPendingSubmissions,
} from '~/features/highline-registration/state/selectors';
import { useRegistrationState } from '~/features/highline-registration/state/store';
import { replayPendingHighlineSubmissions } from '~/features/highline-registration/submission-queue';
import { useMapStore } from '~/store/map-store';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  ActivityIcon,
  AlertCircleIcon,
  CalendarClockIcon,
  HeartIcon,
  PlusIcon,
  PowerOffIcon,
  RulerIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import { useHighline, type HighlineCategory } from '~/hooks/use-highline';
import { useMountEffect } from '~/hooks/use-mount-effect';
import { cn } from '~/lib/utils';
import {
  _layoutAnimation,
  DEFAULT_LATITUDE,
  DEFAULT_LONGITUDE,
} from '~/utils/constants';

import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import { WeatherSummary } from './weather-info-card';

/**
 * Owns the camera subscription on its own so a pan re-renders this one label
 * instead of the whole sheet handle (title, search field and category strip).
 */
const HeaderWeatherSummary: React.FC = React.memo(() => {
  const center = useMapStore(useShallow((state) => state.camera.center));

  const latitude = center?.[1] ?? DEFAULT_LATITUDE;
  const longitude = center?.[0] ?? DEFAULT_LONGITUDE;

  return <WeatherSummary latitude={latitude} longitude={longitude} />;
});

HeaderWeatherSummary.displayName = 'HeaderWeatherSummary';

// Categories config
const CATEGORIES: { category: HighlineCategory; icon: typeof HeartIcon }[] = [
  { category: 'favorites', icon: HeartIcon },
  { category: 'big line', icon: RulerIcon },
  { category: 'rigged', icon: ActivityIcon },
  { category: 'unrigged', icon: PowerOffIcon },
  { category: 'planned', icon: CalendarClockIcon },
];

/**
 * ExploreHeader - Bottom sheet handle content
 * Reads all data from Zustand store and React Query hooks.
 * This component is memoized and should only be used within a gorhom/bottom-sheet handleComponent.
 */
const ExploreHeader = React.memo(() => {
  const { t } = useTranslation();
  const setBottomSheetHandlerHeight = useMapStore(
    (state) => state.setBottomSheeHandlerHeight,
  );

  // Read search/category from store
  const searchQuery = useMapStore((state) => state.searchQuery);
  const setSearchQuery = useMapStore((state) => state.setSearchQuery);
  const activeCategory = useMapStore((state) => state.activeCategory);
  const setActiveCategory = useMapStore((state) => state.setActiveCategory);

  // Local input state for immediate feedback, debounce store update
  const [localInput, setLocalInput] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    (text: string) => {
      setLocalInput(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setSearchQuery(text), 300);
    },
    [setSearchQuery],
  );

  const handleClearInput = useCallback(() => {
    setLocalInput('');
    setSearchQuery('');
  }, [setSearchQuery]);

  useMountEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  });

  const { highlines, isLoading } = useHighline({
    searchTerm: searchQuery,
    category: activeCategory,
  });

  const categories = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        ...c,
        name: t(
          `components.map.explore-header.categories.${c.category === 'big line' ? 'bigLine' : c.category}`,
        ),
      })),
    [t],
  );

  const scrollRef = useRef<ScrollView>(null);
  const categoryLayouts = useRef<Array<{ x: number; width: number }>>([]);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.get() }],
    width: indicatorWidth.get(),
  }));

  const handleCategoryPress = useCallback(
    (index: number) => {
      const layout = categoryLayouts.current[index];
      const category = CATEGORIES[index].category;

      if (activeCategory === category) {
        setActiveCategory(null);
        indicatorWidth.set(withTiming(0, { duration: 250 }));
      } else {
        setActiveCategory(category);
        if (layout) {
          indicatorX.set(withTiming(layout.x, { duration: 250 }));
          indicatorWidth.set(withTiming(layout.width, { duration: 250 }));
          scrollRef.current?.scrollTo({
            x: layout.x - 16,
            y: 0,
            animated: true,
          });
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [activeCategory, setActiveCategory, indicatorWidth, indicatorX],
  );

  return (
    <View
      onLayout={(e) => setBottomSheetHandlerHeight(e.nativeEvent.layout.height)}
      className="gap-3 pb-2 bg-background"
    >
      {/* Drag Handle */}
      <View className="pt-3">
        <View className="mx-auto w-10 h-1 bg-muted-foreground rounded-md" />
      </View>

      {/* Header Row */}
      <View className="flex-row justify-between items-center px-4">
        <View className="flex-row items-center gap-1">
          <Animated.Text
            layout={_layoutAnimation}
            className={cn(
              'text-center font-extrabold text-3xl tabular-nums',
              isLoading ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {isLoading ? <ActivityIndicator /> : highlines.length}
          </Animated.Text>
          <Animated.Text
            layout={_layoutAnimation}
            className={cn(
              'text-center font-extrabold text-3xl',
              isLoading ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {t(
              highlines.length === 1
                ? 'components.map.explore-header.highline'
                : 'components.map.explore-header.highlines',
            )}
          </Animated.Text>
        </View>
        <View className="flex-row items-center gap-3">
          <HeaderWeatherSummary />
          <AddHighlineButton />
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4">
        <View className="flex-row bg-muted gap-3 p-3 items-center border-hairline border-muted rounded-2xl">
          <Icon
            as={SearchIcon}
            strokeWidth={3}
            className="size-5 text-muted-foreground"
          />
          <BottomSheetTextInput
            key={searchQuery}
            placeholder={t('components.map.explore-header.searchPlaceholder')}
            defaultValue={searchQuery}
            onChangeText={handleInputChange}
            className="flex-1 text-primary font-semibold"
            placeholderTextColor="#9ca3af"
          />
          {localInput.length > 0 && (
            <TouchableOpacity onPress={handleClearInput} hitSlop={8}>
              <Icon
                as={XIcon}
                strokeWidth={2}
                className="size-5 text-muted-foreground"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Chips */}
      <View className="relative">
        <ScrollView
          horizontal
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="relative items-center px-4 gap-2"
        >
          {categories.map((item, index) => (
            <TouchableOpacity
              key={item.category}
              onPress={() => handleCategoryPress(index)}
              onLayout={(event: LayoutChangeEvent) => {
                const { x, width } = event.nativeEvent.layout;
                categoryLayouts.current[index] = { x, width };
              }}
              className="bg-background flex-row items-center justify-center gap-2 p-1 pb-2 px-2 rounded-lg"
            >
              <Icon
                as={item.icon}
                className={cn(
                  'size-4',
                  activeCategory === item.category
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              />
              <Text
                className={cn(
                  'text-sm font-semibold',
                  activeCategory === item.category
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
          {activeCategory !== null && (
            <Animated.View
              className="h-[2px] bg-blue-500 absolute bottom-0"
              style={animatedIndicatorStyle}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );
});

ExploreHeader.displayName = 'ExploreHeader';

// Add Highline Button
const NeedsAttentionModal: React.FC<{
  submissions: QueuedHighlineSubmission[];
  visible: boolean;
  canEdit: boolean;
  onClose: () => void;
  onRetry: (submission: QueuedHighlineSubmission) => void;
  onEdit: (submission: QueuedHighlineSubmission) => void;
  onDiscard: (submission: QueuedHighlineSubmission) => void;
}> = ({
  submissions,
  visible,
  canEdit,
  onClose,
  onRetry,
  onEdit,
  onDiscard,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45">
        <View className="gap-3 rounded-t-3xl bg-background p-4 pb-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <AlertCircleIcon size={20} color="#DC2626" />
              <Text className="text-lg font-bold text-foreground">
                {t('components.map.explore-header.needsAttention')}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('components.map.explore-header.cancel')}
              onPress={onClose}
              className="size-10 items-center justify-center rounded-full bg-muted"
            >
              <Icon as={XIcon} className="size-5 text-foreground" />
            </TouchableOpacity>
          </View>

          {submissions.map((submission) => (
            <View
              key={submission.submissionId}
              className="gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-3"
            >
              <View className="gap-1">
                <Text className="font-semibold text-foreground">
                  {submission.form.name ||
                    t('components.map.explore-header.unnamedHighline')}
                </Text>
                {submission.lastError?.message ? (
                  <Text className="text-sm text-muted-foreground">
                    {submission.lastError.message}
                  </Text>
                ) : null}
                {!canEdit ? (
                  <Text className="text-sm text-muted-foreground">
                    {t('components.map.explore-header.resolveDraftFirst')}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('components.map.explore-header.retry')}
                  onPress={() => onRetry(submission)}
                  className="flex-1 items-center rounded-xl bg-primary px-3 py-2"
                >
                  <Text className="font-semibold text-primary-foreground">
                    {t('components.map.explore-header.retry')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('components.map.explore-header.edit')}
                  accessibilityState={{ disabled: !canEdit }}
                  onPress={() => onEdit(submission)}
                  disabled={!canEdit}
                  className="flex-1 items-center rounded-xl border border-border bg-background px-3 py-2 disabled:opacity-40"
                >
                  <Text className="font-semibold text-foreground">
                    {t('components.map.explore-header.edit')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t(
                    'components.map.explore-header.discard',
                  )}
                  onPress={() => onDiscard(submission)}
                  className="flex-1 items-center rounded-xl bg-destructive px-3 py-2"
                >
                  <Text className="font-semibold text-destructive-foreground">
                    {t('components.map.explore-header.discard')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const AddHighlineButton: React.FC = React.memo(() => {
  const { profile, session, sessionLoading } = useAuth();
  const ownerId = session?.user.id ?? profile?.id;

  if (sessionLoading) return null;
  if (!ownerId) return <SignedOutAddHighlineButton />;

  return <AddHighlineButtonForOwner key={ownerId} ownerId={ownerId} />;
});

/** Registration needs an owner for the durable draft, so sign in first. */
const SignedOutAddHighlineButton: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Button
      size="icon"
      className="rounded-full"
      onPress={() => router.push('/(modals)/login')}
      accessibilityRole="button"
      accessibilityLabel={t('components.map.explore-header.addHighline')}
    >
      <Icon as={PlusIcon} className="size-5 text-primary-foreground" />
    </Button>
  );
};

const AddHighlineButtonForOwner: React.FC<{ ownerId: string }> = React.memo(
  ({ ownerId }) => {
    const { t } = useTranslation();
    const { state: registration, store } = useRegistrationState(ownerId);
    const queryClient = useQueryClient();
    const isOnline = useOnlineStatus();
    const requestLocationPicker = useMapStore(
      (state) => state.requestLocationPicker,
    );
    const [attentionVisible, setAttentionVisible] = useState(false);
    const hasActiveDraft = registration.activeDraft !== null;
    const needsAttention = useMemo(
      () => selectNeedsAttentionSubmissions(registration),
      [registration],
    );
    const pendingSyncCount = useMemo(
      () => selectPendingSubmissions(registration).length,
      [registration],
    );
    const hasNeedsAttention = needsAttention.length > 0;
    const primaryLabel = t(
      hasActiveDraft
        ? 'components.map.explore-header.continueHighline'
        : 'components.map.explore-header.addHighline',
    );
    const attentionLabel = t(
      'components.map.explore-header.needsAttentionCount',
      { count: needsAttention.length },
    );
    const pendingSyncLabel = t(
      'components.map.explore-header.pendingSyncCount',
      { count: pendingSyncCount },
    );

    // The inline picker reads the mounted map's current camera directly; this
    // button only needs to announce the requested mode.
    const handlePress = useCallback(() => {
      requestLocationPicker({ kind: 'new' });
    }, [requestLocationPicker]);

    const handleRetry = useCallback(
      (submission: QueuedHighlineSubmission) => {
        setAttentionVisible(false);
        void store
          .dispatch({
            type: 'retry',
            submissionId: submission.submissionId,
          })
          .then(() =>
            isOnline
              ? replayPendingHighlineSubmissions(queryClient, ownerId)
              : undefined,
          );
      },
      [isOnline, ownerId, queryClient, store],
    );

    const handleEdit = useCallback(
      (submission: QueuedHighlineSubmission) => {
        if (store.getState().activeDraft) return;

        setAttentionVisible(false);
        void store
          .dispatch({
            type: 'edit-submission',
            submissionId: submission.submissionId,
          })
          .then((next) => {
            // The reducer rejects editing while another draft is active. Do not
            // open the picker in that case, or it would resume that unrelated
            // draft and make the failed submission appear to have been edited.
            if (next.activeDraft?.draftId !== submission.sourceDraftId) return;
            requestLocationPicker({ kind: 'new' });
          });
      },
      [requestLocationPicker, store],
    );

    const handleDiscard = useCallback(
      (submission: QueuedHighlineSubmission) => {
        setAttentionVisible(false);
        void (async () => {
          await store.dispatch({
            type: 'discard',
            submissionId: submission.submissionId,
          });
          await removeStagedHighlineImage(submission.form.image);
        })();
      },
      [store],
    );

    return (
      <View className="flex-row items-center gap-2">
        <Button
          size={hasActiveDraft ? 'default' : 'icon'}
          className="rounded-full"
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
        >
          <Icon as={PlusIcon} className="size-5 text-primary-foreground" />
          {hasActiveDraft ? (
            <Text className="font-semibold text-primary-foreground">
              {primaryLabel}
            </Text>
          ) : null}
        </Button>

        {hasNeedsAttention ? (
          <Button
            size="default"
            variant="outline"
            className="rounded-full border-destructive/40 px-3"
            onPress={() => setAttentionVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={attentionLabel}
          >
            <AlertCircleIcon size={18} color="#DC2626" />
            <Text className="font-semibold text-destructive">
              {attentionLabel}
            </Text>
          </Button>
        ) : null}

        {pendingSyncCount > 0 ? (
          <View
            accessibilityLabel={pendingSyncLabel}
            className="rounded-full bg-amber-100 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-amber-900">
              {pendingSyncLabel}
            </Text>
          </View>
        ) : null}

        <NeedsAttentionModal
          submissions={needsAttention}
          visible={attentionVisible && hasNeedsAttention}
          canEdit={!hasActiveDraft}
          onClose={() => setAttentionVisible(false)}
          onRetry={handleRetry}
          onEdit={handleEdit}
          onDiscard={handleDiscard}
        />
      </View>
    );
  },
);

AddHighlineButton.displayName = 'AddHighlineButton';
AddHighlineButtonForOwner.displayName = 'AddHighlineButtonForOwner';

export default ExploreHeader;
