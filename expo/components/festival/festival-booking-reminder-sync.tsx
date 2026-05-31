import { type ViewerFestivalBooking } from '@chooselife/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useI18n } from '~/context/i18n';
import { useMountEffect } from '~/hooks/use-mount-effect';

import { scheduleFestivalBookingSlotReminder } from '~/components/festival/festival-booking-reminders';

export function FestivalBookingReminderSync({
  bookings,
  festivalTimeZone,
}: {
  bookings: ViewerFestivalBooking[];
  festivalTimeZone: string;
}) {
  const { locale } = useI18n();
  const syncKey = React.useMemo(
    () =>
      bookings
        .map(
          ({ card, dayKey, slot }) =>
            `${slot.booking?.id ?? 'missing'}:${slot.id}:${slot.startAt}:${card.highline.name}:${dayKey}`,
        )
        .join('|'),
    [bookings],
  );

  return (
    <FestivalBookingReminderSyncMount
      key={`${locale}:${festivalTimeZone}:${syncKey}`}
      bookings={bookings}
      festivalTimeZone={festivalTimeZone}
      locale={locale}
    />
  );
}

function FestivalBookingReminderSyncMount({
  bookings,
  festivalTimeZone,
  locale,
}: {
  bookings: ViewerFestivalBooking[];
  festivalTimeZone: string;
  locale: string;
}) {
  const { t } = useTranslation();

  useMountEffect(() => {
    async function syncReminders() {
      for (const { card, dayKey, slot } of bookings) {
        if (!slot.booking?.id) {
          continue;
        }

        await scheduleFestivalBookingSlotReminder({
          bookingId: slot.booking.id,
          card,
          dayKey,
          festivalTimeZone,
          locale,
          slot,
          t,
        });
      }
    }

    void syncReminders();
  });

  return null;
}
