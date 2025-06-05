import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeInRight,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useDebounceValue } from '~/hooks/use-debounce-value';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { _layoutAnimation, DAMPING, STIFFNESS } from '~/utils/constants';
import type { Tables } from '~/utils/database.types';

import { Skeleton } from '~/components/ui/skeleton';

interface UserOption {
  username: string;
  verified: boolean;
  id?: string;
  name?: string;
  profile_picture?: string;
}

interface UserPickerProps {
  defaultValue?: string[];
  disabled?: boolean;
  placeholder: string;
  onValueChange: (value: string[], userIds: string[]) => void;
  minSelection?: number;
  maxSelection?: number;
  canPickNonUser?: boolean;
  className?: string;
}

const Badge: React.FC<{
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: 'default' | 'selected';
}> = ({ children, onRemove, variant = 'default' }) => {
  const handlePress = useCallback(() => {
    if (onRemove) {
      // Immediate action without waiting for animation
      onRemove();
    }
  }, [onRemove]);

  return (
    <Animated.View
      className={`
        flex-row items-center justify-center px-3 p-2 gap-1 rounded-xl border bg-gray-100
        ${variant === 'selected' ? 'border-blue-300' : 'border-gray-300'}
      `}
      entering={FadeInRight.delay(50)
        .damping(DAMPING)
        .stiffness(STIFFNESS)
        .springify()}
      exiting={FadeOutDown.damping(DAMPING).stiffness(STIFFNESS).springify()}
    >
      {children}
      {onRemove && (
        <Pressable hitSlop={18} onPress={handlePress}>
          <LucideIcon
            name="X"
            className="size-4 text-red-400"
            strokeWidth={3}
          />
        </Pressable>
      )}
    </Animated.View>
  );
};

// Selection Summary Component
const SelectionSummary: React.FC<{
  selectedCount: number;
  minSelection: number;
  maxSelection?: number;
}> = ({ selectedCount, minSelection, maxSelection }) => {
  const getSelectionText = (): string => {
    if (minSelection > 0 && maxSelection) {
      return `(${selectedCount}/${minSelection}-${maxSelection})`;
    } else if (minSelection > 0) {
      return `(${selectedCount}/${minSelection}+)`;
    } else if (maxSelection) {
      return `(${selectedCount}/${maxSelection})`;
    }
    return selectedCount > 0 ? `(${selectedCount})` : '';
  };

  const selectionText = getSelectionText();

  return selectionText ? (
    <Text className="text-xs text-gray-500">{selectionText}</Text>
  ) : null;
};

// Verified User Component
const VerifiedUser: React.FC<{
  profile: Tables<'profiles'>;
  canSelectMore: boolean;
  toggleOption: (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => void;
}> = ({ profile, canSelectMore, toggleOption }) => {
  if (!profile.username) return null;

  const username = profile.username;
  const isDisabled = !canSelectMore;

  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // Use useEffect to update opacity when isDisabled changes
  useEffect(() => {
    opacity.value = withTiming(isDisabled ? 0.5 : 1, { duration: 150 });
  }, [isDisabled, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (!isDisabled) {
      // Faster animation and immediate action
      scale.value = withTiming(0.95, { duration: 50 }, (finished) => {
        if (finished) {
          scale.value = withTiming(1, { duration: 50 });
        }
      });

      // Execute action immediately
      toggleOption({
        username,
        verified: true,
        id: profile.id,
      });
    }
  }, [isDisabled, scale, toggleOption, username, profile.id]);

  return (
    <Animated.View style={animatedStyle} layout={_layoutAnimation}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        className="flex-row items-center p-3 rounded-lg border border-muted-foreground"
        activeOpacity={0.7}
      >
        {profile.profile_picture && (
          <Image
            source={{ uri: profile.profile_picture }}
            className="w-6 h-6 rounded-full mr-3"
            // defaultSource={require('./placeholder.png')} // Add a placeholder image
          />
        )}

        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
            {profile.name}
          </Text>
          <Text className="text-sm text-gray-500">{username}</Text>
        </View>

        <LucideIcon name="BadgeCheck" className="size-6 text-blue-500" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Unverified User Component
const UnverifiedUser: React.FC<{
  normalizedSearch: string;
  toggleOption: (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => void;
}> = ({ normalizedSearch, toggleOption }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // Faster animation and immediate action
    scale.value = withTiming(0.95, { duration: 50 }, (finished) => {
      if (finished) {
        scale.value = withTiming(1, { duration: 50 });
      }
    });

    // Execute action immediately
    toggleOption({
      username: normalizedSearch,
      verified: false,
    });
  }, [scale, toggleOption, normalizedSearch]);

  return (
    <Animated.View
      className="mb-4"
      layout={_layoutAnimation}
      entering={FadeInUp.damping(DAMPING).stiffness(STIFFNESS)}
      exiting={FadeOutUp.damping(DAMPING).stiffness(STIFFNESS)}
    >
      <Text className="text-sm font-medium text-gray-500 mb-2">Instagram</Text>
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={handlePress}
          className="flex-row items-center p-4 rounded-lg bg-white gap-3 border border-muted-foreground"
          activeOpacity={0.7}
        >
          <Text className="text-sm text-gray-900">{normalizedSearch}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

// Main UserPicker Component
export const UserPicker: React.FC<UserPickerProps> = ({
  defaultValue = [],
  onValueChange,
  disabled = false,
  placeholder,
  minSelection = 0,
  maxSelection,
  canPickNonUser = false,
  className,
}) => {
  const { t } = useTranslation();

  // Use ref instead of state for controlling the modal
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const snapPoints = useMemo(() => ['80%'], []);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounceValue(search);
  const normalizedSearch = useMemo(
    () => (!search || search.startsWith('@') ? search : `@${search}`),
    [search],
  );

  const { data: profiles, isPending } = useQuery({
    queryKey: ['profiles', { username: debouncedSearch }],
    queryFn: async () => {
      const query = supabase.from('profiles').select('*').neq('name', null);
      if (debouncedSearch) {
        query.ilike('username', `%${debouncedSearch}%`);
      } else {
        query.limit(5);
      }
      const response = await query;
      return response.data;
    },
  });

  const [selectedOptions, setSelectedOptions] = useState<UserOption[]>(() => {
    return defaultValue.map((username) => ({
      username,
      verified: false,
      id: undefined,
    }));
  });

  const unselectedProfiles = React.useMemo(() => {
    if (!profiles) return [];

    const selectedUsernames = new Set(
      selectedOptions.map((option) => option.username),
    );

    return profiles.filter(
      (profile) => profile.username && !selectedUsernames.has(profile.username),
    );
  }, [profiles, selectedOptions]);

  const canSelectMore = useMemo(() => {
    if (!maxSelection) return true;
    return selectedOptions.length < maxSelection;
  }, [selectedOptions.length, maxSelection]);

  const toggleOption = useCallback(
    (option: { username: string; verified: boolean; id?: string }) => {
      setSelectedOptions((prev) => {
        const idx = prev.findIndex(
          (value) => value.username === option.username,
        );
        if (idx === -1) {
          if (!maxSelection || prev.length < maxSelection) {
            setSearch('');
            return [...prev, option];
          }
          return prev;
        } else {
          return prev.filter((v) => v.username !== option.username);
        }
      });
    },
    [maxSelection],
  );

  const removeOption = useCallback((option: UserOption) => {
    setSelectedOptions((prev) =>
      prev.filter((item) => item.username !== option.username),
    );
  }, []);

  useEffect(() => {
    const usernames = selectedOptions.map((value) => value.username);
    const userIds = selectedOptions
      .map((value) => value.id || '')
      .filter(Boolean);

    onValueChangeRef.current(usernames, userIds);
  }, [selectedOptions]);

  const handleClearAll = useCallback(() => {
    setSelectedOptions([]);
    setSearch('');
  }, []);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleSearchChange = React.useCallback((text: string) => {
    setSearch(text);
  }, []);

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        onPress={handlePresentModalPress}
        disabled={disabled}
        className={`
          min-h-12 w-full flex-row items-center justify-between p-3 rounded-lg border border-gray-300 bg-white
          ${disabled ? 'opacity-50' : ''}
          ${className || ''}
        `}
      >
        {selectedOptions.length > 0 ? (
          <View className="flex-1 flex-row items-center justify-between">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-1"
            >
              <View className="flex-row items-center gap-3">
                {selectedOptions.map((value) => (
                  <Badge key={`badge-${value.username}`} variant="selected">
                    <View className="flex-row items-center gap-2">
                      {value.verified && (
                        <LucideIcon
                          name="BadgeCheck"
                          className="size-4 text-blue-500"
                        />
                      )}
                      <Text className="text-sm">{value.username}</Text>
                    </View>
                  </Badge>
                ))}
              </View>
            </ScrollView>
            <SelectionSummary
              selectedCount={selectedOptions.length}
              minSelection={minSelection}
              maxSelection={maxSelection}
            />
          </View>
        ) : (
          <View className="flex-1 flex-row items-center justify-between">
            <Text className="text-sm text-gray-500">{placeholder}</Text>
            <SelectionSummary
              selectedCount={selectedOptions.length}
              minSelection={minSelection}
              maxSelection={maxSelection}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        snapPoints={snapPoints}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#999' }}
        enableDynamicSizing={false}
      >
        <BottomSheetView className="flex-1 px-4">
          {/* Header */}
          <View className="mb-4">
            <Text className="text-lg font-semibold text-center mb-4">
              {t('components.user-picker.header')}
            </Text>

            {/* Search Input */}
            <View className="flex-row items-center bg-white rounded-lg border border-gray-300 px-3">
              <LucideIcon name="Search" size={20} className="text-primary" />

              <BottomSheetTextInput
                placeholder={t('components.user-picker.searchPlaceholder')}
                defaultValue={search}
                onChangeText={handleSearchChange}
                className="flex-1 p-4"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Selected Users Section */}
          {selectedOptions.length > 0 && (
            <Animated.View
              entering={FadeInUp.damping(DAMPING).stiffness(STIFFNESS)}
              exiting={FadeOutUp.damping(DAMPING).stiffness(STIFFNESS)}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm font-medium">
                  {t('components.user-picker.selectedUsers')}{' '}
                  <SelectionSummary
                    selectedCount={selectedOptions.length}
                    minSelection={minSelection}
                    maxSelection={maxSelection}
                  />
                </Text>
                <TouchableOpacity onPress={handleClearAll}>
                  <Text className="text-red-500 text-sm">
                    {t('components.user-picker.clearAll')}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-3">
                  {selectedOptions.map((value) => (
                    <Badge
                      key={`selected-${value.username}`}
                      variant="selected"
                      onRemove={() => removeOption(value)}
                    >
                      <View className="flex-row items-center">
                        {value.verified && (
                          <LucideIcon
                            name="BadgeCheck"
                            className="size-4 text-blue-500 mr-1"
                          />
                        )}
                        <Text className="text-sm">{value.username}</Text>
                      </View>
                    </Badge>
                  ))}
                </View>
              </ScrollView>
              <View className="h-px bg-gray-200 my-4" />
            </Animated.View>
          )}

          {/* Users List */}
          <BottomSheetScrollView layout={_layoutAnimation} className="flex-1">
            {/* Unverified Users */}
            {canPickNonUser &&
              canSelectMore &&
              search.length > 0 &&
              ![...(profiles || []), ...selectedOptions].find(
                (v) => v.username === normalizedSearch,
              ) && (
                <UnverifiedUser
                  normalizedSearch={normalizedSearch}
                  toggleOption={toggleOption}
                />
              )}

            {/* Verified Users */}
            {unselectedProfiles && unselectedProfiles.length > 0 && (
              <Animated.View layout={_layoutAnimation} className="gap-4 mb-2">
                <Text className="text-sm font-medium text-gray-500 mb-2">
                  {t('components.user-picker.verifiedUsers')}
                </Text>
                {unselectedProfiles.map((profile) => (
                  <VerifiedUser
                    key={profile.id}
                    profile={profile}
                    canSelectMore={canSelectMore}
                    toggleOption={toggleOption}
                  />
                ))}
              </Animated.View>
            )}

            {/* Loading State */}
            {isPending && (
              <View className="gap-2">
                {[...Array(5)].map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-12 bg-gray-200 rounded-lg animate-pulse"
                  />
                ))}
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
};
