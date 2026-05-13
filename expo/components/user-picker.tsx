import {
  formatUsernameForDisplay,
  normalizeUsernameInput,
} from '@chooselife/ui';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheckIcon, SearchIcon, XIcon } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { supabase } from '~/lib/supabase';
import { _layoutAnimation, DAMPING, STIFFNESS } from '~/utils/constants';
import type { Tables } from '~/utils/database.types';

import { Icon } from '~/components/ui/icon';
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

type VerifiedProfile = Tables<'profiles'> & {
  username: string;
};

const hasUsername = (
  profile: Tables<'profiles'>,
): profile is VerifiedProfile => {
  return typeof profile.username === 'string' && profile.username.length > 0;
};

const getUserPickerValue = (options: UserOption[]) => {
  const usernames = options.map((value) => value.username);
  const userIds = options.map((value) => value.id || '').filter(Boolean);

  return {
    usernames,
    userIds,
  };
};

const Badge: React.FC<{
  children: React.ReactNode;
  onRemove?: () => void;
  variant?: 'default' | 'selected';
}> = ({ children, onRemove, variant = 'default' }) => {
  const handlePress = useCallback(() => {
    onRemove?.();
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
          <Icon as={XIcon} className="size-4 text-red-400" strokeWidth={3} />
        </Pressable>
      )}
    </Animated.View>
  );
};

const SelectionSummary: React.FC<{
  selectedCount: number;
  minSelection: number;
  maxSelection?: number;
}> = ({ selectedCount, minSelection, maxSelection }) => {
  const getSelectionText = (): string => {
    if (minSelection > 0 && maxSelection) {
      return `(${selectedCount}/${minSelection}-${maxSelection})`;
    }

    if (minSelection > 0) {
      return `(${selectedCount}/${minSelection}+)`;
    }

    if (maxSelection) {
      return `(${selectedCount}/${maxSelection})`;
    }

    return selectedCount > 0 ? `(${selectedCount})` : '';
  };

  const selectionText = getSelectionText();

  return selectionText ? (
    <Text className="text-xs text-gray-500">{selectionText}</Text>
  ) : null;
};

const VerifiedUser: React.FC<{
  profile: VerifiedProfile;
  canSelectMore: boolean;
  toggleOption: (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => void;
}> = ({ profile, canSelectMore, toggleOption }) => {
  const username = profile.username;
  const isDisabled = !canSelectMore;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isDisabled ? 0.5 : 1, { duration: 150 }),
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (isDisabled) return;

    scale.value = withTiming(0.95, { duration: 50 }, (finished) => {
      if (finished) {
        scale.value = withTiming(1, { duration: 50 });
      }
    });

    toggleOption({
      username,
      verified: true,
      id: profile.id,
    });
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
          />
        )}

        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
            {profile.name}
          </Text>

          <Text className="text-sm text-gray-500">
            {formatUsernameForDisplay(username)}
          </Text>
        </View>

        <Icon as={BadgeCheckIcon} className="size-6 text-blue-500" />
      </TouchableOpacity>
    </Animated.View>
  );
};

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
    scale.value = withTiming(0.95, { duration: 50 }, (finished) => {
      if (finished) {
        scale.value = withTiming(1, { duration: 50 });
      }
    });

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
          <Text className="text-sm text-gray-900">
            {formatUsernameForDisplay(normalizedSearch)}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

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

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const snapPoints = useMemo(() => ['80%'], []);

  const [search, setSearch] = useState('');

  const [selectedOptions, setSelectedOptions] = useState<UserOption[]>(() => {
    return defaultValue.map((username) => ({
      username: normalizeUsernameInput(username),
      verified: false,
      id: undefined,
    }));
  });

  const normalizedSearch = useMemo(
    () => normalizeUsernameInput(search),
    [search],
  );

  const debouncedSearch = useDebounceValue(normalizedSearch);

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

      return response.data ?? [];
    },
  });

  const unselectedProfiles = useMemo(() => {
    if (!profiles) return [];

    const selectedUsernames = new Set(
      selectedOptions.map((option) => option.username),
    );

    return profiles
      .filter(hasUsername)
      .filter((profile) => !selectedUsernames.has(profile.username));
  }, [profiles, selectedOptions]);

  const canSelectMore = useMemo(() => {
    if (!maxSelection) return true;

    return selectedOptions.length < maxSelection;
  }, [selectedOptions.length, maxSelection]);

  const alreadyHasNormalizedSearch = useMemo(() => {
    return [...(profiles ?? []), ...selectedOptions].some(
      (value) => value.username === normalizedSearch,
    );
  }, [profiles, selectedOptions, normalizedSearch]);

  const commitSelectedOptions = useCallback(
    (nextOptions: UserOption[]) => {
      setSelectedOptions(nextOptions);

      const { usernames, userIds } = getUserPickerValue(nextOptions);

      onValueChange(usernames, userIds);
    },
    [onValueChange],
  );

  const toggleOption = useCallback(
    (option: { username: string; verified: boolean; id?: string }) => {
      const optionIndex = selectedOptions.findIndex(
        (value) => value.username === option.username,
      );

      if (optionIndex === -1) {
        if (maxSelection && selectedOptions.length >= maxSelection) {
          return;
        }

        const nextOptions = [...selectedOptions, option];

        setSearch('');
        commitSelectedOptions(nextOptions);

        return;
      }

      const nextOptions = selectedOptions.filter(
        (value) => value.username !== option.username,
      );

      commitSelectedOptions(nextOptions);
    },
    [commitSelectedOptions, maxSelection, selectedOptions],
  );

  const removeOption = useCallback(
    (option: UserOption) => {
      const nextOptions = selectedOptions.filter(
        (item) => item.username !== option.username,
      );

      commitSelectedOptions(nextOptions);
    },
    [commitSelectedOptions, selectedOptions],
  );

  const handleClearAll = useCallback(() => {
    setSearch('');
    commitSelectedOptions([]);
  }, [commitSelectedOptions]);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
  }, []);

  return (
    <>
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
                        <Icon
                          as={BadgeCheckIcon}
                          className="size-4 text-blue-500"
                        />
                      )}

                      <Text className="text-sm">
                        {formatUsernameForDisplay(value.username)}
                      </Text>
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

      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        snapPoints={snapPoints}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: '#999' }}
        enableDynamicSizing={false}
      >
        <BottomSheetView className="flex-1 px-4">
          <View className="mb-4">
            <Text className="text-lg font-semibold text-center mb-4">
              {t('components.user-picker.header')}
            </Text>

            <View className="flex-row items-center bg-white rounded-lg border border-gray-300 px-3">
              <Icon as={SearchIcon} size={20} className="text-primary" />

              <BottomSheetTextInput
                placeholder={t('components.user-picker.searchPlaceholder')}
                value={search}
                onChangeText={handleSearchChange}
                className="flex-1 p-4"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

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
                          <Icon
                            as={BadgeCheckIcon}
                            className="size-4 text-blue-500 mr-1"
                          />
                        )}

                        <Text className="text-sm">
                          {formatUsernameForDisplay(value.username)}
                        </Text>
                      </View>
                    </Badge>
                  ))}
                </View>
              </ScrollView>

              <View className="h-px bg-gray-200 my-4" />
            </Animated.View>
          )}

          <BottomSheetScrollView layout={_layoutAnimation} className="flex-1">
            {canPickNonUser &&
              canSelectMore &&
              normalizedSearch.length > 0 &&
              !alreadyHasNormalizedSearch && (
                <UnverifiedUser
                  normalizedSearch={normalizedSearch}
                  toggleOption={toggleOption}
                />
              )}

            {unselectedProfiles.length > 0 && (
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
