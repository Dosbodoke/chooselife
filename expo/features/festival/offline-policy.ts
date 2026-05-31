export type FestivalScheduleWriteAction = 'book' | 'cancel' | 'staff-book';

export function canMutateFestivalSchedule(options: {
  action: FestivalScheduleWriteAction;
  isOnline: boolean;
}) {
  return options.isOnline;
}

export function shouldRenderOfflineBanner(isOnline: boolean) {
  return !isOnline;
}
