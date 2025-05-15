import { useInfiniteQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';
import { Functions } from '~/utils/database.types';

export type LeaderboardFunctions = Extract<
  keyof Functions,
  | 'get_crossing_time'
  | 'get_highline'
  | 'get_total_cadenas'
  | 'get_total_full_lines'
  | 'get_total_walked'
>;

export type TLeaderboardType =
  | 'cadenas'
  | 'distance'
  | 'fullLine'
  | 'speedline';

export interface UseLeaderboardQueryProps<TFunc extends LeaderboardFunctions> {
  rpcFunction: TFunc;
  type: TLeaderboardType;
  params: Omit<Functions[TFunc]['Args'], 'page_number' | 'page_size'>;
}

const PAGE_SIZE = 5;

// Query key factory
export const leaderboardKeys = {
  list: (params: {
    type: TLeaderboardType;
    highlinesID: string[];
    startDate?: string;
    endDate?: string;
  }) => ['leaderboard', params] as const,
};

export function useLeaderboardQuery<TFunc extends LeaderboardFunctions>({
  rpcFunction,
  type,
  params,
}: UseLeaderboardQueryProps<TFunc>) {
  async function fetchEntries({ pageParam = 1 }) {
    const { data, error } = await supabase.rpc(rpcFunction, {
      ...params,
      page_number: pageParam,
      page_size: PAGE_SIZE,
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  }

  // Safely extract start_date and end_date if they exist in params
  const startDate =
    'start_date' in params
      ? (params.start_date as string | undefined)
      : undefined;
  const endDate =
    'end_date' in params ? (params.end_date as string | undefined) : undefined;

  // Array of highline id's
  let highlinesID: string[] = [];
  if ('highline_ids' in params) {
    highlinesID = params.highline_ids as string[];
  }
  if ('highline_id' in params) {
    highlinesID = [params.highline_id as string];
  }

  const queryKey = leaderboardKeys.list({
    type,
    highlinesID,
    startDate: startDate,
    endDate: endDate,
  });

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchEntries({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const nextPage = pages.length + 1;
      return lastPage?.length === PAGE_SIZE ? nextPage : undefined;
    },
    enabled: !!highlinesID.length,
  });
}
