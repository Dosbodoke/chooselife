import {
  formatUsernameForDisplay,
  normalizeUsernameInput,
  type BookFestivalScheduleSlotInput,
  type FestivalScheduleSlotView,
} from '@chooselife/ui';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheckIcon, SearchIcon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, TouchableOpacity, View } from 'react-native';

import { useI18n } from '~/context/i18n';
import { useDebounceValue } from '~/hooks/use-debounce-value';
import { supabase } from '~/lib/supabase';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

type ProfileOption = {
  id: string;
  name: string | null;
  profilePicture: string | null;
  username: string;
};

type StaffBookingSelection =
  | {
      type: 'profile';
      profile: ProfileOption;
    }
  | {
      type: 'guest';
      username: string;
    };

function formatSlotTimeRange(
  slot: FestivalScheduleSlotView,
  locale: string,
  timeZone: string,
) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

  return `${formatter.format(new Date(slot.startAt))} - ${formatter.format(
    new Date(slot.endAt),
  )}`;
}

const ProfileRow: React.FC<{
  profile: ProfileOption;
  onPress: () => void;
}> = ({ profile, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
    onPress={onPress}
  >
    {profile.profilePicture ? (
      <Image
        source={{ uri: profile.profilePicture }}
        className="h-11 w-11 rounded-full"
      />
    ) : (
      <View className="h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <Text className="text-sm font-semibold text-slate-500">
          {(profile.name ?? profile.username).slice(0, 1).toUpperCase()}
        </Text>
      </View>
    )}

    <View className="flex-1 gap-0.5">
      <Text className="font-semibold text-slate-900">
        {profile.name ?? profile.username}
      </Text>
      <Text className="text-sm text-slate-500">
        {formatUsernameForDisplay(profile.username)}
      </Text>
    </View>

    <Icon as={BadgeCheckIcon} className="size-5 text-blue-500" />
  </TouchableOpacity>
);

const GuestRow: React.FC<{
  username: string;
  subtitle: string;
  onPress: () => void;
}> = ({ username, subtitle, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    className="gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3"
    onPress={onPress}
  >
    <Text className="font-semibold text-slate-900">{username}</Text>
    <Text className="text-sm text-slate-500">{subtitle}</Text>
  </TouchableOpacity>
);

const SelectedParticipantCard: React.FC<{
  guestDisplayName: string;
  label: string;
  selection: StaffBookingSelection;
  guestBadgeLabel: string;
}> = ({ guestBadgeLabel, guestDisplayName, label, selection }) => {
  const title =
    selection.type === 'profile'
      ? (selection.profile.name ?? selection.profile.username)
      : guestDisplayName.trim() || formatUsernameForDisplay(selection.username);

  const subtitle =
    selection.type === 'profile'
      ? formatUsernameForDisplay(selection.profile.username)
      : guestDisplayName.trim()
        ? formatUsernameForDisplay(selection.username)
        : guestBadgeLabel;

  return (
    <View className="gap-1 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
      <Text className="text-xs font-semibold uppercase tracking-[1px] text-slate-500">
        {label}
      </Text>
      <Text className="text-base font-semibold text-slate-900">{title}</Text>
      <Text className="text-sm text-slate-500">{subtitle}</Text>
    </View>
  );
};

export const StaffBookingSheet: React.FC<{
  festivalTimeZone: string;
  isSubmitting: boolean;
  onConfirmBooking: (input: BookFestivalScheduleSlotInput) => Promise<boolean>;
  onDismiss: () => void;
  slot: FestivalScheduleSlotView | null;
}> = ({
  festivalTimeZone,
  isSubmitting,
  onConfirmBooking,
  onDismiss,
  slot,
}) => {
  const { t } = useTranslation();
  const { locale } = useI18n();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const [search, setSearch] = React.useState('');
  const [selection, setSelection] =
    React.useState<StaffBookingSelection | null>(null);
  const [guestDisplayName, setGuestDisplayName] = React.useState('');
  const normalizedSearch = React.useMemo(
    () => normalizeUsernameInput(search),
    [search],
  );

  const resetState = React.useCallback(() => {
    setSearch('');
    setSelection(null);
    setGuestDisplayName('');
  }, []);

  React.useEffect(() => {
    if (slot) {
      resetState();
      bottomSheetModalRef.current?.present();
      return;
    }

    bottomSheetModalRef.current?.dismiss();
  }, [resetState, slot]);

  const debouncedNormalizedSearch = useDebounceValue(normalizedSearch);

  const { data: profiles, isPending } = useQuery({
    enabled: !!slot && !selection,
    queryKey: [
      'staff-booking-profiles',
      { username: debouncedNormalizedSearch },
    ],
    queryFn: async () => {
      const query = supabase
        .from('profiles')
        .select('id, name, username, profile_picture')
        .neq('name', null);

      if (debouncedNormalizedSearch) {
        query.ilike('username', `%${debouncedNormalizedSearch}%`);
      } else {
        query.limit(5);
      }

      const response = await query;
      return (response.data ?? [])
        .filter((profile) => !!profile.username)
        .map((profile) => ({
          id: profile.id,
          name: profile.name,
          profilePicture: profile.profile_picture,
          username: profile.username!,
        })) satisfies ProfileOption[];
    },
  });

  const hasExactProfileMatch = React.useMemo(() => {
    if (!normalizedSearch) {
      return false;
    }

    return (profiles ?? []).some(
      (profile) => profile.username === normalizedSearch,
    );
  }, [normalizedSearch, profiles]);

  const canSelectGuest = !!normalizedSearch && !hasExactProfileMatch;
  const guestNameError =
    selection?.type === 'guest' && !guestDisplayName.trim()
      ? t('app.(festival).highlines.missingGuestName')
      : null;
  const canConfirm =
    !!slot &&
    !!selection &&
    (selection.type === 'profile' || !!guestDisplayName.trim()) &&
    !isSubmitting;

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

  const dismissSheet = React.useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const handleSelectProfile = React.useCallback((profile: ProfileOption) => {
    setSelection({ type: 'profile', profile });
    setSearch('');
    setGuestDisplayName('');
  }, []);

  const handleSelectGuest = React.useCallback(() => {
    if (!normalizedSearch) return;

    setSelection({
      type: 'guest',
      username: normalizedSearch,
    });
    setSearch('');
  }, [normalizedSearch]);

  const handleConfirm = React.useCallback(async () => {
    if (!slot || !selection) {
      return;
    }

    const success = await onConfirmBooking({
      slotId: slot.id,
      profileId: selection.type === 'profile' ? selection.profile.id : null,
      instagramUsername: selection.type === 'guest' ? selection.username : null,
      displayName: selection.type === 'guest' ? guestDisplayName.trim() : null,
    });

    if (success) {
      dismissSheet();
    }
  }, [dismissSheet, guestDisplayName, onConfirmBooking, selection, slot]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      snapPoints={['90%']}
      stackBehavior="push"
      handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
      onDismiss={() => {
        resetState();
        onDismiss();
      }}
    >
      {slot ? (
        <View className="flex-1">
          <BottomSheetScrollView
            className="flex-1"
            contentContainerStyle={{
              gap: 20,
              paddingBottom: 24,
              paddingHorizontal: 20,
              paddingTop: 20,
            }}
          >
            <View className="gap-2">
              <Text className="text-xl font-semibold text-slate-900">
                {t('app.(festival).highlines.staffSheetTitle')}
              </Text>
              <Text className="text-sm font-semibold uppercase tracking-[1px] text-slate-500">
                {formatSlotTimeRange(slot, locale, festivalTimeZone)}
              </Text>
              <Text className="text-sm leading-6 text-slate-500">
                {t('app.(festival).highlines.staffHelperText')}
              </Text>
            </View>

            {selection ? (
              <View className="gap-3">
                <SelectedParticipantCard
                  guestBadgeLabel={t(
                    'app.(festival).highlines.staffGuestBadge',
                  )}
                  guestDisplayName={guestDisplayName}
                  label={t('app.(festival).highlines.staffSelectedLabel')}
                  selection={selection}
                />

                {selection.type === 'guest' ? (
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-slate-700">
                      {t('app.(festival).highlines.staffGuestNameLabel')}
                    </Text>
                    <BottomSheetTextInput
                      autoCapitalize="words"
                      autoCorrect={false}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                      onChangeText={setGuestDisplayName}
                      placeholder={t(
                        'app.(festival).highlines.guestNamePlaceholder',
                      )}
                      value={guestDisplayName}
                    />
                    {guestNameError ? (
                      <Text className="text-sm text-red-600">
                        {guestNameError}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="gap-4">
                <View className="flex-row items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4">
                  <Icon as={SearchIcon} className="size-5 text-slate-400" />
                  <BottomSheetTextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    className="flex-1 py-4 text-base text-slate-900"
                    onChangeText={setSearch}
                    placeholder={t(
                      'app.(festival).highlines.staffPickerPlaceholder',
                    )}
                    value={search}
                  />
                </View>

                {!debouncedNormalizedSearch ? (
                  <Text className="text-xs font-semibold uppercase tracking-[1px] text-slate-500">
                    {t('app.(festival).highlines.staffSuggestionsLabel')}
                  </Text>
                ) : null}

                <View className="gap-3">
                  {(profiles ?? []).map((profile) => (
                    <ProfileRow
                      key={profile.id}
                      onPress={() => handleSelectProfile(profile)}
                      profile={profile}
                    />
                  ))}

                  {canSelectGuest ? (
                    <GuestRow
                      onPress={handleSelectGuest}
                      subtitle={t(
                        'app.(festival).highlines.staffGuestResultSubtitle',
                      )}
                      username={formatUsernameForDisplay(normalizedSearch)}
                    />
                  ) : null}

                  {isPending ? (
                    <View className="gap-3">
                      {[0, 1, 2].map((item) => (
                        <Skeleton
                          key={item}
                          className="h-[72px] rounded-2xl bg-slate-200"
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </BottomSheetScrollView>

          <View className="border-t border-slate-200 bg-white px-5 pb-6 pt-4">
            <View className="flex-row gap-3">
              <Button
                className="flex-1 rounded-xl"
                disabled={isSubmitting}
                onPress={dismissSheet}
                variant="outline"
              >
                <Text className="font-semibold text-slate-900">
                  {t('app.(festival).highlines.cancelStaffBookingButton')}
                </Text>
              </Button>

              <Button
                className="flex-1 rounded-xl bg-[#101b2b]"
                disabled={!canConfirm}
                onPress={handleConfirm}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-semibold text-white">
                    {t('app.(festival).highlines.confirmStaffBookingButton')}
                  </Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      ) : null}
    </BottomSheetModal>
  );
};
