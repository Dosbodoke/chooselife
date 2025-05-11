'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { supabase } from '~/lib/supabase';
import { Tables } from '~/utils/database.types';

export type Event = Tables<'events'>;

export function useEvents() {
  const [searchQuery, setSearchQuery] = useState('');

  const query = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const now = new Date().toISOString();

      return (
        await supabase
          .from('events')
          .select('*')
          .or(`start_date.gte.${now},end_date.gte.${now}`)
          .order('start_date', { ascending: true })
      ).data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 1 day
    gcTime: 24 * 60 * 60 * 1000, // 1 day
  });

  // Filter events based on current filter and search query
  const filteredEvents = useMemo(() => {
    return query.data?.filter((event) => {
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
  }, [query.data, searchQuery]);

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

  return {
    query,
    searchQuery,
    setSearchQuery,
    filteredEvents,
    eventsByMonth,
  };
}
