'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Tables } from '@chooselife/database';
import { useSupabase } from '../../supabase-provider';
import type { ISAEvent } from './types';
import { useUpcomingISAEvents } from './use-isa-events';

/** Re-export ISAEvent type */
export type { ISAEvent };

/** Internal event from Supabase */
export type InternalEvent = Tables<'events'> & { source?: 'internal' };

/** Combined event type that can be from either source */
export type Event = InternalEvent | ISAEvent;

/** Type guard to check if an event is from ISA */
export function isISAEvent(event: Event): event is ISAEvent {
  return 'source' in event && event.source === 'isa';
}

/**
 * Hook to fetch and merge events from Supabase and ISA Calendar
 * Fetches internal events from Supabase and ISA events from Google Calendar,
 * then merges and sorts them by date.
 */
export function useEvents() {
  const { supabase } = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch internal events from Supabase
  const internalQuery = useQuery({
    queryKey: ['events', 'internal'],
    queryFn: async (): Promise<InternalEvent[]> => {
      const now = new Date().toISOString();

      const { data } = await supabase
        .from('events')
        .select('*')
        .or(`start_date.gte.${now},end_date.gte.${now}`)
        .order('start_date', { ascending: true });

      // Mark as internal source
      return (data || []).map((event) => ({
        ...event,
        source: 'internal' as const,
      }));
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    gcTime: 24 * 60 * 60 * 1000, // 1 day
  });

  // Fetch ISA events from Google Calendar
  const isaQuery = useUpcomingISAEvents();

  // Combine loading states
  const isLoading = internalQuery.isPending || isaQuery.isPending;
  const isPending = internalQuery.isPending || isaQuery.isPending;

  // Merge and sort all events
  const allEvents = useMemo(() => {
    const internal: Event[] = internalQuery.data || [];
    const isa: Event[] = isaQuery.data || [];

    const combined = [...internal, ...isa];

    // Sort by start date
    return combined.sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
    );
  }, [internalQuery.data, isaQuery.data]);

  // Filter events based on search query
  const filteredEvents = useMemo(() => {
    return allEvents.filter((event) => {
      // Apply search query
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        event.city.toLowerCase().includes(query) ||
        event.state?.toLowerCase().includes(query) ||
        event.country.toLowerCase().includes(query)
      );
    });
  }, [allEvents, searchQuery]);

  // Group events by month
  const eventsByMonth = useMemo(() => {
    const grouped = (filteredEvents || []).reduce(
      (acc, event) => {
        // Check if startDate exists and is a valid Date object
        if (!event.start_date) {
          return acc; // Skip this event if startDate is invalid
        }

        const startDate = new Date(event.start_date);
        const year = startDate.getFullYear();
        const month = startDate.getMonth();
        const startOfMonthDate = new Date(Date.UTC(year, month + 1, 1));
        const monthKey = startOfMonthDate.toISOString();

        if (!acc[monthKey]) {
          acc[monthKey] = [];
        }

        acc[monthKey].push(event);
        return acc;
      },
      {} as { [date: string]: Event[] },
    );

    // Sort events within each month by date
    Object.keys(grouped).forEach((month) => {
      grouped[month].sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
    });

    return grouped;
  }, [filteredEvents]);

  // Create a combined query object for backwards compatibility
  const query = {
    data: allEvents,
    isPending,
    isLoading,
    isError: internalQuery.isError || isaQuery.isError,
    error: internalQuery.error || isaQuery.error,
  };

  return {
    query,
    searchQuery,
    setSearchQuery,
    filteredEvents,
    eventsByMonth,
    // Expose individual queries for more granular control
    internalQuery,
    isaQuery,
  };
}
