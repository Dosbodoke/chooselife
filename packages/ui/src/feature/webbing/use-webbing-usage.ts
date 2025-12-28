'use client';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '../../supabase-provider';
import { buildWebbingUsage } from './lifetime-utils';
import type { WebbingUsage } from './types';

/**
 * Response type from get_webbing_usage_days RPC
 * This interface defines the shape of the response from the database function.
 * Once DB types are regenerated, this can be replaced with the generated type.
 */
interface WebbingUsageRpcResponse {
  usage_days: number;
  rig_count: number;
}

/**
 * Query key factory for webbing usage
 */
export const webbingUsageKeyFactory = {
  all: () => ['webbing-usage'] as const,
  byId: (webbingId: number) => ['webbing-usage', webbingId] as const,
};

/**
 * Hook to fetch usage days for a specific webbing
 * Calls the get_webbing_usage_days database function
 */
export function useWebbingUsage(
  webbingId: number | undefined,
  recommendedLifetimeDays: number | null = null,
) {
  const { supabase } = useSupabase();

  return useQuery({
    queryKey: webbingUsageKeyFactory.byId(webbingId ?? 0),
    enabled: !!webbingId,
    queryFn: async (): Promise<WebbingUsage> => {
      if (!webbingId) {
        throw new Error('Webbing ID is required');
      }

      // Cast to unknown to bypass type checking until DB types are regenerated
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        params: { webbing_id_param: number },
      ) => Promise<{ data: WebbingUsageRpcResponse[] | null; error: Error | null }>)(
        'get_webbing_usage_days',
        { webbing_id_param: webbingId },
      );

      if (error) {
        throw error;
      }

      // Function returns array with single row
      const result = Array.isArray(data) ? data[0] : null;
      const usageDays = result?.usage_days ?? 0;
      const rigCount = result?.rig_count ?? 0;

      return buildWebbingUsage(usageDays, rigCount, recommendedLifetimeDays);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
