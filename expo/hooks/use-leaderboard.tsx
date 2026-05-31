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
  all: () => ['leaderboard'] as const,
  list: <TFunc extends LeaderboardFunctions>({
    params,
    rpcFunction,
    type,
  }: Pick<
    UseLeaderboardQueryProps<TFunc>,
    'params' | 'rpcFunction' | 'type'
  >) => [...leaderboardKeys.all(), { params, rpcFunction, type }] as const,
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
    return data as unknown as Functions[TFunc]['Returns'];
  }

  // Array of highline id's
  let highlinesID: string[] = [];
  if ('highline_ids' in params) {
    highlinesID = params.highline_ids as string[];
  }
  if ('highline_id' in params) {
    highlinesID = [params.highline_id as string];
  }

  const queryKey = leaderboardKeys.list({
    rpcFunction,
    type,
    params,
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
