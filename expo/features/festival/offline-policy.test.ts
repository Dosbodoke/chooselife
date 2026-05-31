import {
  canMutateFestivalSchedule,
  shouldRenderOfflineBanner,
} from './offline-policy';

describe('festival offline policy', () => {
  it('prevents scheduling while offline', () => {
    expect(
      canMutateFestivalSchedule({ action: 'book', isOnline: false }),
    ).toBe(false);
  });

  it('prevents cancellation while offline', () => {
    expect(
      canMutateFestivalSchedule({ action: 'cancel', isOnline: false }),
    ).toBe(false);
  });

  it('renders the offline banner while offline', () => {
    expect(shouldRenderOfflineBanner(false)).toBe(true);
  });
});
