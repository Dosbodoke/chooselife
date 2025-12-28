import { useQuery } from '@tanstack/react-query';

import { ISA_CALENDARS, type ISACalendarType } from './constants';
import { fetchISACalendarEvents } from './ical-utils';
import type { ISAEvent } from './types';

export const isaCalendarQueryKeys = {
  all: ['isa-calendar'] as const,
  calendar: (type: ISACalendarType) => [...isaCalendarQueryKeys.all, type] as const,
  allCalendars: () => [...isaCalendarQueryKeys.all, 'all'] as const,
};

/**
 * Check if we're running in a web browser environment (not React Native)
 * React Native has a `window` object but no `document`, so we check for both
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Get the proxy base URL for browser environments
 * Returns undefined for non-browser environments (React Native, SSR)
 */
function getProxyBaseUrl(): string | undefined {
  if (isBrowser()) {
    // In browser, use the API proxy to avoid CORS issues
    return '/api/ical';
  }
  return undefined;
}

/**
 * Fetch events from a single ISA calendar
 */
export function useISACalendar(calendarType: ISACalendarType) {
  const calendar = ISA_CALENDARS[calendarType];
  const proxyBaseUrl = getProxyBaseUrl();

  return useQuery<ISAEvent[], Error>({
    queryKey: isaCalendarQueryKeys.calendar(calendarType),
    queryFn: () => fetchISACalendarEvents(calendar.id, calendarType, { proxyBaseUrl }),
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    gcTime: 24 * 60 * 60 * 1000, // 1 day
  });
}

/**
 * Fetch events from all ISA calendars and combine them
 */
export function useISAEvents() {
  const proxyBaseUrl = getProxyBaseUrl();

  return useQuery<ISAEvent[], Error>({
    queryKey: isaCalendarQueryKeys.allCalendars(),
    queryFn: async () => {
      const calendarTypes = Object.keys(ISA_CALENDARS) as ISACalendarType[];
      
      // Fetch all calendars in parallel
      const results = await Promise.allSettled(
        calendarTypes.map((type) =>
          fetchISACalendarEvents(ISA_CALENDARS[type].id, type, { proxyBaseUrl })
        )
      );

      // Combine successful results, ignore failures
      const allEvents: ISAEvent[] = [];
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        } else {
          console.warn('Failed to fetch ISA calendar:', result.reason);
        }
      }

      // Sort by start date
      return allEvents.sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      );
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    gcTime: 24 * 60 * 60 * 1000, // 1 day
  });
}


/**
 * Get upcoming ISA events (from today onwards)
 */
export function useUpcomingISAEvents() {
  const query = useISAEvents();

  const upcomingEvents = query.data?.filter((event) => {
    const eventDate = new Date(event.start_date);
    const now = new Date();
    // Include events that end today or later, or start today or later
    const endDate = event.end_date ? new Date(event.end_date) : eventDate;
    return endDate >= now;
  });

  return {
    ...query,
    data: upcomingEvents,
  };
}
