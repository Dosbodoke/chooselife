import {
  useBookFestivalScheduleSlot,
  useCancelFestivalScheduleBooking,
  type FestivalHighlineScheduleCard,
  type FestivalScheduleSlotView,
} from '@chooselife/ui';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TextInput, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useMountEffect } from '~/hooks/use-mount-effect';

import { FestivalScheduleDayChips } from '~/components/festival/festival-schedule-day-chips';
import { FestivalScheduleSlotRow } from '~/components/festival/festival-schedule-slot-row';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { UserPicker } from '~/components/user-picker';

function buildFestivalScheduleRedirect({
  dayKey,
  highlineId,
}: {
  dayKey: string | null;
  highlineId: string;
}) {
  const params = new URLSearchParams({ highline: highlineId });

  if (dayKey) {
    params.set('day', dayKey);
  }

  return `/festival?${params.toString()}`;
}
export const FestivalScheduleSheet: React.FC<{
  card: FestivalHighlineScheduleCard | null;
  canManage: boolean;
  festivalSlug: string;
  festivalTimeZone: string;
  onDismiss: () => void;
  onSelectDayKey: (dayKey: string) => void;
  selectedDayKey: string | null;
}> = ({
  card,
  canManage,
  festivalSlug,
  festivalTimeZone,
  onDismiss,
  onSelectDayKey,
  selectedDayKey,
}) => {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const router = useRouter();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const { profile } = useAuth();
  const isAuthenticated = !!profile?.id;
  const selectedHighlineId = card?.highline.id ?? null;
  const [staffSlotId, setStaffSlotId] = React.useState<string | null>(null);
  const [selectedUsernames, setSelectedUsernames] = React.useState<string[]>(
    [],
  );
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [guestDisplayName, setGuestDisplayName] = React.useState('');

  const bookMutation = useBookFestivalScheduleSlot({ festivalSlug });
  const cancelMutation = useCancelFestivalScheduleBooking({ festivalSlug });

  React.useEffect(() => {
    if (selectedHighlineId && isFocused) {
      bottomSheetModalRef.current?.present();
      return;
    }

    bottomSheetModalRef.current?.dismiss();
  }, [isFocused, selectedHighlineId]);

  useMountEffect(function dismissSheetOnUnmount() {
    return () => {
      bottomSheetModalRef.current?.dismiss();
    };
  });

  React.useEffect(() => {
    setStaffSlotId(null);
    setSelectedUsernames([]);
    setSelectedUserIds([]);
    setGuestDisplayName('');
  }, [card?.highline.id]);

  const selectedDay =
    card?.days.find((day) => day.dateKey === selectedDayKey) ??
    card?.defaultDay ??
    null;

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

  const resetStaffBooking = React.useCallback(() => {
    setStaffSlotId(null);
    setSelectedUsernames([]);
    setSelectedUserIds([]);
    setGuestDisplayName('');
  }, []);

  const showGenericError = React.useCallback(() => {
    Alert.alert(
      t('app.(festival).highlines.errorTitle'),
      t('app.(festival).highlines.genericError'),
    );
  }, [t]);

  const showLocalError = React.useCallback(
    (message: string) => {
      Alert.alert(t('app.(festival).highlines.errorTitle'), message);
    },
    [t],
  );

  const handleSelfBook = React.useCallback(
    async (slotId: string) => {
      const result = await bookMutation.mutateAsync({ slotId });
      if (!result.success) {
        if (result.error === 'festival_schedule_booking_overlap') {
          showLocalError(t('app.(festival).highlines.scheduleOverlapError'));
          return;
        }

        if (result.error === 'festival_schedule_booking_limit') {
          showLocalError(t('app.(festival).highlines.scheduleLimitError'));
          return;
        }

        showGenericError();
      }
    },
    [bookMutation, showGenericError, showLocalError, t],
  );

  const handleCancelBooking = React.useCallback(
    async (slot: FestivalScheduleSlotView) => {
      if (!slot.booking) return;

      const result = await cancelMutation.mutateAsync({
        bookingId: slot.booking.id,
        reason: slot.booking.isViewer
          ? 'Cancelled by user'
          : 'Cancelled by staff',
      });

      if (!result.success) {
        showGenericError();
      }
    },
    [cancelMutation, showGenericError],
  );

  const handleConfirmStaffBooking = React.useCallback(async () => {
    if (!staffSlotId) return;

    const profileId = selectedUserIds[0] ?? null;
    const instagramUsername = profileId ? null : (selectedUsernames[0] ?? null);

    if (!profileId && !instagramUsername) {
      showLocalError(t('app.(festival).highlines.missingStaffSelection'));
      return;
    }

    if (!profileId && !guestDisplayName.trim()) {
      showLocalError(t('app.(festival).highlines.missingGuestName'));
      return;
    }

    const result = await bookMutation.mutateAsync({
      slotId: staffSlotId,
      profileId,
      instagramUsername,
      displayName: profileId ? null : guestDisplayName.trim(),
    });

    if (!result.success) {
      showGenericError();
      return;
    }

    resetStaffBooking();
  }, [
    bookMutation,
    guestDisplayName,
    resetStaffBooking,
    selectedUserIds,
    selectedUsernames,
    staffSlotId,
    showGenericError,
    showLocalError,
    t,
  ]);

  const handleLoginPress = React.useCallback(() => {
    if (!card) return;

    router.push({
      pathname: '/(modals)/login',
      params: {
        redirect_to: buildFestivalScheduleRedirect({
          highlineId: card.highline.id,
          dayKey: selectedDay?.dateKey ?? card.defaultDayKey,
        }),
      },
    });
  }, [card, router, selectedDay?.dateKey]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      snapPoints={['86%']}
      handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
      onDismiss={() => {
        if (!isFocused && selectedHighlineId) {
          return;
        }

        onDismiss();
      }}
    >
      {card ? (
        <View className="flex-1">
          <View className="border-b border-slate-200 bg-white px-5 pb-4 pt-2">
            <FestivalScheduleDayChips
              days={card.days}
              festivalTimeZone={festivalTimeZone}
              onSelectDayKey={onSelectDayKey}
              selectedDayKey={selectedDay?.dateKey ?? null}
            />
          </View>

          <BottomSheetScrollView
            className="flex-1"
            contentContainerStyle={{
              gap: 24,
              paddingBottom: 80,
              paddingHorizontal: 20,
              paddingTop: 20,
            }}
          >
            <View className="gap-4">
              {!isAuthenticated ? (
                <View className="gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <Text className="text-sm leading-6 text-amber-950">
                    {t('app.(festival).highlines.authRequired')}
                  </Text>
                  <Button
                    className="self-start rounded-xl bg-[#101b2b]"
                    onPress={handleLoginPress}
                  >
                    <Text className="font-semibold text-white">
                      {t('app.(modals).login.EmailSection.loginButton')}
                    </Text>
                  </Button>
                </View>
              ) : null}

              {selectedDay?.slots.length ? (
                <View className="gap-3">
                  {selectedDay.slots.map((slot) => (
                    <FestivalScheduleSlotRow
                      key={slot.id}
                      canManage={canManage}
                      festivalTimeZone={festivalTimeZone}
                      isAuthenticated={isAuthenticated}
                      onCancelBooking={handleCancelBooking}
                      onSelfBook={handleSelfBook}
                      onStaffBook={setStaffSlotId}
                      slot={slot}
                    />
                  ))}
                </View>
              ) : (
                <View className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                  <Text className="text-center text-sm text-slate-500">
                    {t('app.(festival).highlines.emptySchedule')}
                  </Text>
                </View>
              )}

              {canManage && staffSlotId ? (
                <View className="gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <Text className="font-semibold text-slate-900">
                    {t('app.(festival).highlines.staffBookingTitle')}
                  </Text>

                  <UserPicker
                    canPickNonUser
                    maxSelection={1}
                    onValueChange={(usernames, userIds) => {
                      setSelectedUsernames(usernames);
                      setSelectedUserIds(userIds);
                    }}
                    placeholder={t(
                      'app.(festival).highlines.staffPickerPlaceholder',
                    )}
                  />

                  {selectedUserIds.length === 0 &&
                  selectedUsernames.length > 0 ? (
                    <TextInput
                      className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900"
                      onChangeText={setGuestDisplayName}
                      placeholder={t(
                        'app.(festival).highlines.guestNamePlaceholder',
                      )}
                      value={guestDisplayName}
                    />
                  ) : null}

                  <View className="flex-row gap-2">
                    <Button
                      className="bg-[#101b2b]"
                      onPress={handleConfirmStaffBooking}
                    >
                      <Text className="font-semibold text-white">
                        {t(
                          'app.(festival).highlines.confirmStaffBookingButton',
                        )}
                      </Text>
                    </Button>
                    <Button variant="ghost" onPress={resetStaffBooking}>
                      <Text className="font-semibold text-slate-900">
                        {t('app.(festival).highlines.cancelStaffBookingButton')}
                      </Text>
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          </BottomSheetScrollView>
        </View>
      ) : null}
    </BottomSheetModal>
  );
};
