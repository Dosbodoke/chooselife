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
import { useIsFocused, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useI18n } from '~/context/i18n';
import { useOnlineStatus } from '~/context/react-query';
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

const BookingOpensAtAlert: React.FC<{
  dateTime: string;
}> = ({ dateTime }) => {
  const { t } = useTranslation();

  return (
    <View className="gap-2 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
      <Text className="text-sm font-semibold text-amber-950">
        {t('app.(festival).highlines.bookingOpensAtTitle')}
      </Text>

      <Text className="text-sm leading-6 text-amber-900">
        {t('app.(festival).highlines.bookingOpensAtMessage', {
          dateTime,
        })}
      </Text>
    </View>
  );
};

const AuthRequiredAlert: React.FC<{
  onLoginPress: () => void;
}> = ({ onLoginPress }) => {
  const { t } = useTranslation();

  return (
    <View className="gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
      <Text className="text-sm leading-6 text-amber-950">
        {t('app.(festival).highlines.authRequired')}
      </Text>

      <Button
        className="self-start rounded-xl bg-[#101b2b]"
        onPress={onLoginPress}
      >
        <Text className="font-semibold text-white">
          {t('app.(modals).login.EmailSection.loginButton')}
        </Text>
      </Button>
    </View>
  );
};

const OfflineReadOnlyAlert: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View className="gap-2 rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-4">
      <Text className="text-sm font-semibold text-blue-950">
        {t('app.(festival).highlines.offlineReadOnlyTitle')}
      </Text>

      <Text className="text-sm leading-6 text-blue-900">
        {t('app.(festival).highlines.offlineReadOnlyMessage')}
      </Text>
    </View>
  );
};

const EmptyScheduleState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
      <Text className="text-center text-sm text-slate-500">
        {t('app.(festival).highlines.emptySchedule')}
      </Text>
    </View>
  );
};

const ScheduleSlotsList: React.FC<{
  canManage: boolean;
  festivalTimeZone: string;
  isAuthenticated: boolean;
  isOnline: boolean;
  onCancelBooking: (slot: FestivalScheduleSlotView) => void;
  onSelfBook: (slotId: string) => void;
  onStaffBook: (slotId: string | null) => void;
  slots: FestivalScheduleSlotView[];
}> = ({
  canManage,
  festivalTimeZone,
  isAuthenticated,
  isOnline,
  onCancelBooking,
  onSelfBook,
  onStaffBook,
  slots,
}) => {
  if (!slots.length) {
    return <EmptyScheduleState />;
  }

  return (
    <View className="gap-3">
      {slots.map((slot) => (
        <FestivalScheduleSlotRow
          key={slot.id}
          canManage={canManage}
          festivalTimeZone={festivalTimeZone}
          isAuthenticated={isAuthenticated}
          isOnline={isOnline}
          onCancelBooking={onCancelBooking}
          onSelfBook={onSelfBook}
          onStaffBook={onStaffBook}
          slot={slot}
        />
      ))}
    </View>
  );
};

const FestivalScheduleContent: React.FC<{
  bookingOpensAtLabel: string | null;
  canManage: boolean;
  card: FestivalHighlineScheduleCard;
  festivalTimeZone: string;
  isAuthenticated: boolean;
  isOnline: boolean;
  onCancelBooking: (slot: FestivalScheduleSlotView) => void;
  onLoginPress: () => void;
  onSelectDayKey: (dayKey: string) => void;
  onSelfBook: (slotId: string) => void;
  onStaffBook: (slotId: string | null) => void;
  selectedDay: FestivalHighlineScheduleCard['days'][number] | null;
}> = ({
  bookingOpensAtLabel,
  canManage,
  card,
  festivalTimeZone,
  isAuthenticated,
  isOnline,
  onCancelBooking,
  onLoginPress,
  onSelectDayKey,
  onSelfBook,
  onStaffBook,
  selectedDay,
}) => {
  const shouldShowBookingOpensAtAlert =
    !!selectedDay && !selectedDay.isBookingOpen && !!bookingOpensAtLabel;

  return (
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
          {shouldShowBookingOpensAtAlert ? (
            <BookingOpensAtAlert dateTime={bookingOpensAtLabel} />
          ) : null}

          {!isAuthenticated ? (
            <AuthRequiredAlert onLoginPress={onLoginPress} />
          ) : null}

          {!isOnline ? <OfflineReadOnlyAlert /> : null}

          <ScheduleSlotsList
            canManage={canManage}
            festivalTimeZone={festivalTimeZone}
            isAuthenticated={isAuthenticated}
            isOnline={isOnline}
            onCancelBooking={onCancelBooking}
            onSelfBook={onSelfBook}
            onStaffBook={onStaffBook}
            slots={selectedDay?.slots ?? []}
          />
        </View>
      </BottomSheetScrollView>
    </View>
  );
};

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

  const selectedDay =
    card?.days.find((day) => day.dateKey === selectedDayKey) ??
    card?.defaultDay ??
    null;

  const bookingOpensAtLabel = selectedDay?.bookingOpensAt
    ? formatBookingOpensAt(selectedDay.bookingOpensAt, locale, festivalTimeZone)
    : null;

  const staffSlot =
    card?.days
      .flatMap((day) => day.slots)
      .find((slot) => slot.id === staffSlotId) ?? null;

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

  const showBookingError = React.useCallback(
    (error?: string) => {
      if (error === 'festival_schedule_booking_overlap') {
        Alert.alert(
          t('app.(festival).highlines.errorTitle'),
          t('app.(festival).highlines.scheduleOverlapError'),
        );
        return;
      }

      if (error === 'festival_schedule_booking_limit') {
        Alert.alert(
          t('app.(festival).highlines.errorTitle'),
          t('app.(festival).highlines.scheduleLimitError'),
        );
        return;
      }

      if (error === 'festival_schedule_booking_not_open_yet') {
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
    },
    [bookingOpensAtLabel, showGenericError, t],
  );

  const handleSelfBook = React.useCallback(
    async (slotId: string) => {
      if (!isOnline) {
        showOfflineWriteAlert();
        return;
      }

      const result = await bookMutation.mutateAsync({ slotId });

      if (!result.success) {
        showBookingError(result.error);
      }
    },
    [bookMutation, isOnline, showBookingError, showOfflineWriteAlert],
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
          <FestivalScheduleContent
            bookingOpensAtLabel={bookingOpensAtLabel}
            canManage={canManage}
            card={card}
            festivalTimeZone={festivalTimeZone}
            isAuthenticated={isAuthenticated}
            isOnline={isOnline}
            onCancelBooking={handleCancelBooking}
            onLoginPress={handleLoginPress}
            onSelectDayKey={onSelectDayKey}
            onSelfBook={handleSelfBook}
            onStaffBook={setStaffSlotId}
            selectedDay={selectedDay}
          />
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
