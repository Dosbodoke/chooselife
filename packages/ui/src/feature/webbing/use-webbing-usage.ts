'use client';

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from '../../supabase-provider';
import { deriveWebbingUsage } from './lifetime-utils';
import type { WebbingUsage, WebbingUsageRecord } from './types';

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
 * Query key factory for webbing usage. Keys are scoped by the viewer so one
 * account never reads another account's cached inventory.
 */
export const webbingUsageKeyFactory = {
  all: () => ['webbing-usage'] as const,
  byId: (webbingId: number, viewerId: string | undefined) =>
    ['webbing-usage', viewerId ?? 'public', webbingId] as const,
};

/**
 * Hook to fetch recorded usage for a specific webbing.
 *
 * Only the raw RPC result is cached; the lifetime assessment is derived from
 * the current `recommendedLifetimeDays`, so metadata that arrives later
 * updates the assessment without another fetch. `data` is null while loading
 * or after an error -- never a zero-use or "good" placeholder.
 */
export function useWebbingUsage(
  webbingId: number | undefined,
  recommendedLifetimeDays: number | null = null,
) {
  const { supabase, userId } = useSupabase();

  const query = useQuery({
    queryKey: webbingUsageKeyFactory.byId(webbingId ?? 0, userId),
    enabled: !!webbingId,
    meta: { authScope: userId },
    queryFn: async (): Promise<WebbingUsageRecord> => {
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
      return {
        usageDays: result?.usage_days ?? 0,
        rigCount: result?.rig_count ?? 0,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const usage: WebbingUsage | null = deriveWebbingUsage(
    query.data,
    recommendedLifetimeDays,
  );

  return {
    ...query,
    record: query.data,
    data: usage,
  };
}
