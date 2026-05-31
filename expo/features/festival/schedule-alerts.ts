import type { TFunction } from 'i18next';

export type FestivalScheduleAlertKind =
  | 'booking-success'
  | 'cancellation-success'
  | 'connectivity-error'
  | 'generic-error'
  | 'limit-error'
  | 'not-open-error'
  | 'offline-write'
  | 'overlap-error'
  | 'staff-booking-success'
  | 'staff-cancellation-success';

export function getFestivalScheduleAlert({
  bookingOpensAtLabel,
  highlineName,
  kind,
  participantLabel,
  t,
}: {
  bookingOpensAtLabel?: string | null;
  highlineName?: string;
  kind: FestivalScheduleAlertKind;
  participantLabel?: string;
  t: TFunction;
}) {
  switch (kind) {
    case 'booking-success':
      return {
        title: t('app.(festival).highlines.bookingSuccessTitle'),
        message: t('app.(festival).highlines.bookingSuccessMessage', {
          highline: highlineName,
        }),
      };
    case 'cancellation-success':
      return {
        title: t('app.(festival).highlines.cancellationSuccessTitle'),
        message: t('app.(festival).highlines.cancellationSuccessMessage', {
          highline: highlineName,
        }),
      };
    case 'connectivity-error':
      return {
        title: t('app.(festival).highlines.connectivityErrorTitle'),
        message: t('app.(festival).highlines.connectivityErrorMessage'),
      };
    case 'limit-error':
      return {
        title: t('app.(festival).highlines.errorTitle'),
        message: t('app.(festival).highlines.scheduleLimitError'),
      };
    case 'not-open-error':
      return {
        title: t('app.(festival).highlines.errorTitle'),
        message: bookingOpensAtLabel
          ? t('app.(festival).highlines.scheduleNotOpenError', {
              dateTime: bookingOpensAtLabel,
            })
          : t('app.(festival).highlines.genericError'),
      };
    case 'offline-write':
      return {
        title: t('app.(festival).highlines.offlineActionTitle'),
        message: t('app.(festival).highlines.offlineActionMessage'),
      };
    case 'overlap-error':
      return {
        title: t('app.(festival).highlines.errorTitle'),
        message: t('app.(festival).highlines.scheduleOverlapError'),
      };
    case 'staff-booking-success':
      return {
        title: t('app.(festival).highlines.staffBookingSuccessTitle'),
        message: t('app.(festival).highlines.staffBookingSuccessMessage', {
          highline: highlineName,
          participant: participantLabel,
        }),
      };
    case 'staff-cancellation-success':
      return {
        title: t('app.(festival).highlines.staffCancellationSuccessTitle'),
        message: t('app.(festival).highlines.staffCancellationSuccessMessage', {
          highline: highlineName,
          participant: participantLabel,
        }),
      };
    case 'generic-error':
      return {
        title: t('app.(festival).highlines.errorTitle'),
        message: t('app.(festival).highlines.genericError'),
      };
  }
}

export function getFestivalScheduleErrorAlertKind(error?: string) {
  switch (error) {
    case 'festival_schedule_connectivity_failed':
      return 'connectivity-error';
    case 'festival_schedule_booking_overlap':
      return 'overlap-error';
    case 'festival_schedule_booking_limit':
      return 'limit-error';
    case 'festival_schedule_booking_not_open_yet':
      return 'not-open-error';
    default:
      return 'generic-error';
  }
}
