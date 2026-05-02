import {
  useBookFestivalScheduleSlot,
  useCancelFestivalScheduleBooking,
  type FestivalHighlineScheduleCard,
  type FestivalScheduleSlotView,
} from '@chooselife/ui';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useAuth } from '~/context/auth';
import { useMountEffect } from '~/hooks/use-mount-effect';

import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { UserPicker } from '~/components/user-picker';

const EdgeFade: React.FC<{
  direction: 'left' | 'right';
}> = ({ direction }) => (
  <View
    className={`pointer-events-none absolute bottom-0 top-0 w-6 ${
      direction === 'left' ? 'left-0' : 'right-0'
    }`}
  >
    <Svg height="100%" width="100%">
      <Defs>
        <LinearGradient
          id={`chip-edge-fade-${direction}`}
          x1={direction === 'left' ? '0%' : '100%'}
          y1="0%"
          x2={direction === 'left' ? '100%' : '0%'}
          y2="0%"
        >
          <Stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        fill={`url(#chip-edge-fade-${direction})`}
        height="100%"
        width="100%"
      />
    </Svg>
  </View>
);

function formatDayLabel(dateKey: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone,
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function formatSlotTimeRange(slot: FestivalScheduleSlotView, timeZone: string) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });

  return `${formatter.format(new Date(slot.startAt))} - ${formatter.format(
    new Date(slot.endAt),
  )}`;
}

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

const SlotRow: React.FC<{
  canManage: boolean;
  festivalTimeZone: string;
  isAuthenticated: boolean;
  onCancelBooking: (slot: FestivalScheduleSlotView) => void;
  onSelfBook: (slotId: string) => void;
  onStaffBook: (slotId: string) => void;
  slot: FestivalScheduleSlotView;
}> = ({
  canManage,
  festivalTimeZone,
  isAuthenticated,
  onCancelBooking,
  onSelfBook,
  onStaffBook,
  slot,
}) => {
  const { t } = useTranslation();
  const isPastSlot =
    !slot.isCurrent && new Date(slot.endAt).getTime() <= Date.now();
  const title = slot.booking?.participant.primaryText ?? null;
  const subtitle =
    slot.state === 'blocked'
      ? slot.blockReason
      : (slot.booking?.participant.secondaryText ?? null);
  const disabledSelfBookingLabel =
    slot.selfBookingBlockedReason === 'overlap'
      ? t('app.(festival).highlines.claimSlotBlockedOverlap')
      : slot.selfBookingBlockedReason === 'limit'
        ? t('app.(festival).highlines.claimSlotBlockedLimit')
        : null;
  const isFreeSlot = slot.state === 'available';

  return (
    <View
      className={`gap-3 rounded-2xl border px-4 py-4 ${
        slot.isCurrent
          ? 'border-emerald-200 bg-emerald-50'
          : isPastSlot
            ? 'border-dashed border-slate-300 bg-slate-50'
            : isFreeSlot
              ? 'border-emerald-300 bg-emerald-50/50'
              : slot.state === 'blocked'
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-200 bg-white'
      }`}
    >
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text
            className={`text-sm font-semibold uppercase tracking-[1px] ${
              isPastSlot ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {formatSlotTimeRange(slot, festivalTimeZone)}
          </Text>
          {title ? (
            <Text
              className={`text-base font-semibold ${
                isPastSlot ? 'text-slate-500' : 'text-slate-900'
              }`}
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              className={`text-sm ${
                isPastSlot ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View
          className={`rounded-full px-2 py-1 ${
            isPastSlot
              ? 'bg-slate-200'
              : isFreeSlot
                ? 'bg-emerald-100'
                : 'bg-slate-100'
          }`}
        >
          <Text
            className={`text-[11px] font-semibold uppercase tracking-[0.8px] ${
              isPastSlot
                ? 'text-slate-400'
                : isFreeSlot
                  ? 'text-emerald-700'
                  : 'text-slate-500'
            }`}
          >
            {slot.isCurrent
              ? t('app.(festival).highlines.currentLabel')
              : slot.state === 'available'
                ? t('app.(festival).highlines.availableState')
                : slot.state === 'booked'
                  ? t('app.(festival).highlines.bookedState')
                  : slot.state === 'completed'
                    ? t('app.(festival).highlines.completedLabel')
                    : slot.state === 'blocked'
                      ? t('app.(festival).highlines.blockedTitle')
                      : t('app.(festival).highlines.expiredLabel')}
          </Text>
        </View>
      </View>

      {slot.state === 'available' && isAuthenticated ? (
        <View className="flex-row flex-wrap gap-2">
          {slot.canSelfBook ? (
            <Button
              className="rounded-xl bg-[#101b2b]"
              onPress={() => onSelfBook(slot.id)}
            >
              <Text className="font-semibold text-white">
                {t('app.(festival).highlines.claimSlotButton')}
              </Text>
            </Button>
          ) : disabledSelfBookingLabel ? (
            <View className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-sm font-semibold text-red-700 text-center">
                {disabledSelfBookingLabel}
              </Text>
            </View>
          ) : null}

          {canManage ? (
            <Button variant="secondary" onPress={() => onStaffBook(slot.id)}>
              <Text className="font-semibold text-slate-900">
                {t('app.(festival).highlines.bookForSomeoneButton')}
              </Text>
            </Button>
          ) : null}
        </View>
      ) : null}

      {slot.booking &&
      (slot.booking.isViewer || canManage) &&
      slot.state === 'booked' ? (
        <Button
          variant={slot.booking.isViewer ? 'destructive' : 'outline'}
          onPress={() => onCancelBooking(slot)}
        >
          <Text
            className={`font-semibold ${
              slot.booking.isViewer ? 'text-white' : 'text-slate-900'
            }`}
          >
            {slot.booking.isViewer
              ? t('app.(festival).highlines.cancelOwnBookingButton')
              : t('app.(festival).highlines.cancelBookingButton')}
          </Text>
        </Button>
      ) : null}
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
  const dayChipsScrollRef = React.useRef<ScrollView>(null);
  const dayChipLayoutsRef = React.useRef<
    Record<string, { width: number; x: number }>
  >({});
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
  const visibleDayKey = selectedDay?.dateKey ?? null;

  const scrollSelectedDayChipIntoView = React.useCallback(
    (dayKey: string | null) => {
      if (!dayKey) return;

      const layout = dayChipLayoutsRef.current[dayKey];
      if (!layout) return;

      dayChipsScrollRef.current?.scrollTo({
        x: Math.max(layout.x - 20, 0),
        animated: false,
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!selectedHighlineId) return;

    const timeout = setTimeout(() => {
      scrollSelectedDayChipIntoView(visibleDayKey);
    }, 0);

    return () => clearTimeout(timeout);
  }, [scrollSelectedDayChipIntoView, selectedHighlineId, visibleDayKey]);

  const handleDayChipLayout = React.useCallback(
    (dayKey: string, event: LayoutChangeEvent) => {
      dayChipLayoutsRef.current[dayKey] = event.nativeEvent.layout;
      if (dayKey === visibleDayKey) {
        scrollSelectedDayChipIntoView(dayKey);
      }
    },
    [scrollSelectedDayChipIntoView, visibleDayKey],
  );

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
            <View className="-mx-5 relative">
              <ScrollView
                ref={dayChipsScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                <View className="flex-row gap-2 px-5">
                  {card.days.map((day) => (
                    <Pressable
                      key={day.dateKey}
                      className={`rounded-full px-3 py-2 ${
                        selectedDay?.dateKey === day.dateKey
                          ? 'bg-[#101b2b]'
                          : 'bg-slate-100'
                      }`}
                      onLayout={(event) =>
                        handleDayChipLayout(day.dateKey, event)
                      }
                      onPress={() => onSelectDayKey(day.dateKey)}
                    >
                      <Text
                        className={`font-semibold ${
                          selectedDay?.dateKey === day.dateKey
                            ? 'text-white'
                            : 'text-slate-600'
                        }`}
                      >
                        {formatDayLabel(day.dateKey, festivalTimeZone)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              <EdgeFade direction="left" />
              <EdgeFade direction="right" />
            </View>
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
                    <SlotRow
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
