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
import { Alert, View } from 'react-native';

import { useOnlineStatus } from '~/context/react-query';
import { useAuth } from '~/context/auth';
import { useI18n } from '~/context/i18n';
import { useMountEffect } from '~/hooks/use-mount-effect';

import { FestivalScheduleDayChips } from '~/components/festival/festival-schedule-day-chips';
import { FestivalScheduleSlotRow } from '~/components/festival/festival-schedule-slot-row';
import { StaffBookingSheet } from '~/components/festival/staff-booking-sheet';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

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

function formatBookingOpensAt(
  dateTime: string,
  locale: string,
  timeZone: string,
) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(dateTime));
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
  const isOnline = useOnlineStatus();
  const { profile } = useAuth();
  const { locale } = useI18n();
  const isAuthenticated = !!profile?.id;
  const selectedHighlineId = card?.highline.id ?? null;
  const [staffSlotId, setStaffSlotId] = React.useState<string | null>(null);

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
  }, [card?.highline.id]);

  const selectedDay =
    card?.days.find((day) => day.dateKey === selectedDayKey) ??
    card?.defaultDay ??
    null;
  const bookingOpensAtLabel = selectedDay?.bookingOpensAt
    ? formatBookingOpensAt(
        selectedDay.bookingOpensAt,
        locale,
        festivalTimeZone,
      )
    : null;
  const staffSlot =
    card?.days
      .flatMap((day) => day.slots)
      .find((slot) => slot.id === staffSlotId) ?? null;

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

  const showGenericError = React.useCallback(() => {
    Alert.alert(
      t('app.(festival).highlines.errorTitle'),
      t('app.(festival).highlines.genericError'),
    );
  }, [t]);

  const showOfflineWriteAlert = React.useCallback(() => {
    Alert.alert(
      t('app.(festival).highlines.offlineActionTitle'),
      t('app.(festival).highlines.offlineActionMessage'),
    );
  }, [t]);

  const handleSelfBook = React.useCallback(
    async (slotId: string) => {
      if (!isOnline) {
        showOfflineWriteAlert();
        return;
      }

      const result = await bookMutation.mutateAsync({ slotId });
      if (!result.success) {
        if (result.error === 'festival_schedule_booking_overlap') {
          Alert.alert(
            t('app.(festival).highlines.errorTitle'),
            t('app.(festival).highlines.scheduleOverlapError'),
          );
          return;
        }

        if (result.error === 'festival_schedule_booking_limit') {
          Alert.alert(
            t('app.(festival).highlines.errorTitle'),
            t('app.(festival).highlines.scheduleLimitError'),
          );
          return;
        }

        if (result.error === 'festival_schedule_booking_not_open_yet') {
          Alert.alert(
            t('app.(festival).highlines.errorTitle'),
            bookingOpensAtLabel
              ? t('app.(festival).highlines.scheduleNotOpenError', {
                  dateTime: bookingOpensAtLabel,
                })
              : t('app.(festival).highlines.genericError'),
          );
          return;
        }

        showGenericError();
      }
    },
    [
      bookMutation,
      bookingOpensAtLabel,
      isOnline,
      showGenericError,
      showOfflineWriteAlert,
      t,
    ],
  );

  const handleCancelBooking = React.useCallback(
    async (slot: FestivalScheduleSlotView) => {
      if (!slot.booking) return;
      if (!isOnline) {
        showOfflineWriteAlert();
        return;
      }

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
    [cancelMutation, isOnline, showGenericError, showOfflineWriteAlert],
  );

  const handleConfirmStaffBooking = React.useCallback(
    async ({
      displayName,
      instagramUsername,
      profileId,
      slotId,
    }: {
      displayName?: string | null;
      instagramUsername?: string | null;
      profileId?: string | null;
      slotId: string;
    }) => {
      if (!isOnline) {
        showOfflineWriteAlert();
        return false;
      }

      const result = await bookMutation.mutateAsync({
        slotId,
        profileId,
        instagramUsername,
        displayName,
      });

      if (!result.success) {
        showGenericError();
        return false;
      }

      setStaffSlotId(null);
      return true;
    },
    [bookMutation, isOnline, showGenericError, showOfflineWriteAlert],
  );

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
    <>
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
                {!selectedDay?.isBookingOpen && bookingOpensAtLabel ? (
                  <View className="gap-2 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                    <Text className="text-sm font-semibold text-amber-950">
                      {t('app.(festival).highlines.bookingOpensAtTitle')}
                    </Text>
                    <Text className="text-sm leading-6 text-amber-900">
                      {t('app.(festival).highlines.bookingOpensAtMessage', {
                        dateTime: bookingOpensAtLabel,
                      })}
                    </Text>
                  </View>
                ) : null}

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

                {!isOnline ? (
                  <View className="gap-2 rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-4">
                    <Text className="text-sm font-semibold text-blue-950">
                      {t('app.(festival).highlines.offlineReadOnlyTitle')}
                    </Text>
                    <Text className="text-sm leading-6 text-blue-900">
                      {t('app.(festival).highlines.offlineReadOnlyMessage')}
                    </Text>
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
                        isOnline={isOnline}
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
              </View>
            </BottomSheetScrollView>
          </View>
        ) : null}
      </BottomSheetModal>

      <StaffBookingSheet
        festivalTimeZone={festivalTimeZone}
        isSubmitting={bookMutation.isPending}
        onConfirmBooking={handleConfirmStaffBooking}
        onDismiss={() => {
          setStaffSlotId(null);
        }}
        slot={canManage && isOnline ? staffSlot : null}
      />
    </>
  );
};
