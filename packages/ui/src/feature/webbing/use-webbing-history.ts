'use client';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '../../supabase-provider';
import type { WebbingRigHistory } from './types';

/**
 * Query key factory for webbing history
 */
export const webbingHistoryKeyFactory = {
  all: () => ['webbing-history'] as const,
  byId: (webbingId: number) => ['webbing-history', webbingId] as const,
};

/**
 * Calculate duration in days between two dates
 */
function calculateDurationDays(
  rigDate: string,
  unriggedAt: string | null,
): number {
  const start = new Date(rigDate);
  const end = unriggedAt ? new Date(unriggedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Hook to fetch full rig history for a specific webbing
 * Returns all rigs where this webbing was used, with highline info
 */
export function useWebbingHistory(webbingId: number | undefined) {
  const { supabase } = useSupabase();

  return useQuery({
    queryKey: webbingHistoryKeyFactory.byId(webbingId ?? 0),
    enabled: !!webbingId,
    queryFn: async (): Promise<WebbingRigHistory[]> => {
      if (!webbingId) {
        throw new Error('Webbing ID is required');
      }

      // Fetch rig_setup_webbing with rig_setup and highline info
      const { data, error } = await supabase
        .from('rig_setup_webbing')
        .select(
          `
          id,
          setup_id,
          webbing_type,
          rig_setup!inner (
            id,
            highline_id,
            rig_date,
            unrigged_at,
            is_rigged,
            highline!inner (
              id,
              name
            )
          )
        `,
        )
        .eq('webbing_id', webbingId)
        .order('setup_id', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the data
      return (data ?? []).map((row) => {
        const setup = row.rig_setup as unknown as {
          id: number;
          highline_id: string;
          rig_date: string;
          unrigged_at: string | null;
          is_rigged: boolean;
          highline: { id: string; name: string };
        };

        return {
          setupId: setup.id,
          highlineId: setup.highline_id,
          highlineName: setup.highline?.name ?? 'Unknown',
          rigDate: setup.rig_date,
          unriggedAt: setup.unrigged_at,
          durationDays: calculateDurationDays(setup.rig_date, setup.unrigged_at),
          webbingType: row.webbing_type,
        };
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
