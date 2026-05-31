import {
  buildFestivalScheduleRedirect,
  type FestivalHighlineScheduleCard,
  type FestivalScheduleSlotView,
} from '@chooselife/ui';
import * as Notifications from 'expo-notifications';
import type { TFunction } from 'i18next';
import { Platform } from 'react-native';

const FESTIVAL_REMINDER_LEAD_TIME_MS = 30 * 60 * 1000;
const FESTIVAL_REMINDER_CHANNEL_ID = 'festival-schedule-reminders';

function getFestivalReminderNotificationId(bookingId: string) {
  return `festival-schedule-reminder:${bookingId}`;
}

export async function cancelFestivalBookingReminder(bookingId: string) {
  await Notifications.cancelScheduledNotificationAsync(
    getFestivalReminderNotificationId(bookingId),
  ).catch(() => undefined);
}

export async function scheduleFestivalBookingReminder({
  bookingId,
  body,
  slotId,
  slotStartAt,
  title,
  url,
}: {
  bookingId: string;
  body: string;
  slotId: string;
  slotStartAt: string;
  title: string;
  url: string;
}) {
  const remindAt = new Date(
    new Date(slotStartAt).getTime() - FESTIVAL_REMINDER_LEAD_TIME_MS,
  );

  if (remindAt.getTime() <= Date.now()) {
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      FESTIVAL_REMINDER_CHANNEL_ID,
      {
        name: 'Festival schedule reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      },
    );
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  const finalStatus =
    existingStatus === 'granted'
      ? existingStatus
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== 'granted') {
    return;
  }

  await cancelFestivalBookingReminder(bookingId);

  await Notifications.scheduleNotificationAsync({
    identifier: getFestivalReminderNotificationId(bookingId),
    content: {
      title,
      body,
      sound: 'default',
      data: {
        type: 'festival_schedule_reminder',
        booking_id: bookingId,
        slot_id: slotId,
        url,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: remindAt,
      channelId: FESTIVAL_REMINDER_CHANNEL_ID,
    },
  });
}

export async function scheduleFestivalBookingSlotReminder({
  bookingId,
  card,
  dayKey,
  festivalTimeZone,
  locale,
  slot,
  t,
}: {
  bookingId?: string;
  card: FestivalHighlineScheduleCard;
  dayKey: string | null;
  festivalTimeZone: string;
  locale: string;
  slot: FestivalScheduleSlotView;
  t: TFunction;
}) {
  if (!bookingId) {
    return;
  }

  const startTime = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: festivalTimeZone,
  }).format(new Date(slot.startAt));

  await scheduleFestivalBookingReminder({
    bookingId,
    slotId: slot.id,
    slotStartAt: slot.startAt,
    title: t('app.(festival).highlines.localReminderTitle'),
    body: t('app.(festival).highlines.localReminderBody', {
      highline: card.highline.name,
      time: startTime,
    }),
    url: buildFestivalScheduleRedirect({
      highlineId: card.highline.id,
      dayKey,
    }),
  });
}

export async function scheduleFestivalBookingCardSlotReminder({
  bookingId,
  card,
  dayKey,
  festivalTimeZone,
  locale,
  slotId,
  t,
}: {
  bookingId?: string;
  card: FestivalHighlineScheduleCard;
  dayKey: string | null;
  festivalTimeZone: string;
  locale: string;
  slotId: string;
  t: TFunction;
}) {
  const slot =
    card.days.flatMap((day) => day.slots).find((item) => item.id === slotId) ??
    null;

  if (!slot) {
    return;
  }

  await scheduleFestivalBookingSlotReminder({
    bookingId,
    card,
    dayKey,
    festivalTimeZone,
    locale,
    slot,
    t,
  });
}
