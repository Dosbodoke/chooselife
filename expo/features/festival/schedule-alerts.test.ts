import type { TFunction } from 'i18next';

import {
  getFestivalScheduleAlert,
  getFestivalScheduleErrorAlertKind,
} from './schedule-alerts';

const t = jest.fn((key: string) => key) as unknown as TFunction;

describe('festival schedule alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps connectivity failures to the connectivity-specific alert', () => {
    expect(
      getFestivalScheduleErrorAlertKind(
        'festival_schedule_connectivity_failed',
      ),
    ).toBe('connectivity-error');
  });

  it('maps cooldown failures to the cooldown-specific alert', () => {
    expect(
      getFestivalScheduleErrorAlertKind('festival_schedule_booking_cooldown'),
    ).toBe('cooldown-error');
  });

  it('uses the offline write copy when an offline mutation is blocked', () => {
    expect(
      getFestivalScheduleAlert({ bookingLimit: 2, kind: 'offline-write', t }),
    ).toEqual({
      title: 'app.(festival).highlines.offlineActionTitle',
      message: 'app.(festival).highlines.offlineActionMessage',
    });
  });

  it('includes the runtime booking limit in limit errors', () => {
    getFestivalScheduleAlert({ bookingLimit: 2, kind: 'limit-error', t });

    expect(t).toHaveBeenCalledWith(
      'app.(festival).highlines.scheduleLimitError',
      { count: 2 },
    );
  });

  it('includes the highline when a viewer confirms a booking', () => {
    getFestivalScheduleAlert({
      bookingLimit: 2,
      highlineName: 'Gringo Boingo',
      kind: 'booking-success',
      t,
    });

    expect(t).toHaveBeenCalledWith(
      'app.(festival).highlines.bookingSuccessMessage',
      { highline: 'Gringo Boingo' },
    );
  });

  it('includes the highline when a viewer cancels a booking', () => {
    getFestivalScheduleAlert({
      bookingLimit: 2,
      highlineName: 'Gringo Boingo',
      kind: 'cancellation-success',
      t,
    });

    expect(t).toHaveBeenCalledWith(
      'app.(festival).highlines.cancellationSuccessMessage',
      { highline: 'Gringo Boingo' },
    );
  });

  it('includes the participant and highline when staff confirms a booking', () => {
    getFestivalScheduleAlert({
      bookingLimit: 2,
      highlineName: 'Gringo Boingo',
      kind: 'staff-booking-success',
      participantLabel: 'Ana',
      t,
    });

    expect(t).toHaveBeenCalledWith(
      'app.(festival).highlines.staffBookingSuccessMessage',
      { highline: 'Gringo Boingo', participant: 'Ana' },
    );
  });

  it('includes the participant and highline when staff cancels a booking', () => {
    getFestivalScheduleAlert({
      bookingLimit: 2,
      highlineName: 'Gringo Boingo',
      kind: 'staff-cancellation-success',
      participantLabel: 'Ana',
      t,
    });

    expect(t).toHaveBeenCalledWith(
      'app.(festival).highlines.staffCancellationSuccessMessage',
      { highline: 'Gringo Boingo', participant: 'Ana' },
    );
  });
});
