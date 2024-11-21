import { useInfiniteQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { supabase } from '~/lib/supabase';
import { Functions } from '~/utils/database.types';

import { Text } from '../ui/text';
import { Leaderboard } from './leaderboard';
import { LoadingLeaderboard, LoadingRows } from './loading-skeleton';
import SeeMore from './see-more';

type LeaderboardFunctions = Extract<
  keyof Functions,
  | 'get_crossing_time'
  | 'get_highline'
  | 'get_total_cadenas'
  | 'get_total_full_lines'
  | 'get_total_walked'
>;

interface UseLeaderboardQueryProps<TFunc extends LeaderboardFunctions> {
  rpcFunction: TFunc;
  queryKey: Array<string | string[]>;
  highlineIds: string | string[];
  params: Omit<Functions[TFunc]['Args'], 'page_number' | 'page_size'>;
}

type EntryTransformReturn = {
  name: string;
  position: number;
  value: string;
  profilePicture: string;
};

interface LeaderboardContainerProps<TFunc extends LeaderboardFunctions>
  extends UseLeaderboardQueryProps<TFunc> {
  entryTransform: (
    entry: Functions[TFunc]['Returns'][number],
    index: number,
    pageIndex: number,
  ) => EntryTransformReturn | null;
}

const PAGE_SIZE = 5;

export function useLeaderboardQuery<TFunc extends LeaderboardFunctions>({
  rpcFunction,
  queryKey,
  highlineIds,
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

  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchEntries({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const nextPage = pages.length + 1;
      return lastPage?.length === PAGE_SIZE ? nextPage : undefined;
    },
    enabled: !!highlineIds.length,
  });
}

const LeaderboardContainer = <TFunc extends LeaderboardFunctions>({
  rpcFunction,
  queryKey,
  highlineIds,
  params,
  entryTransform,
}: LeaderboardContainerProps<TFunc>) => {
  const {
    data: entries,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLeaderboardQuery({ rpcFunction, queryKey, highlineIds, params });

  if (isLoading) {
    return <LoadingLeaderboard />;
  }

  if (isError) {
    return (
      <View>
        <Text>OOPS! Aconteceu algum error. Tente recarregar a página.</Text>
      </View>
    );
  }

  const transformedEntries = entries?.pages.flatMap(
    (page, pageIdx) =>
      page?.map((entry, idx) => entryTransform(entry, idx, pageIdx)) || [],
  ) || [null, null, null];

  return (
    <>
      <Leaderboard entries={transformedEntries} />
      {isFetchingNextPage && <LoadingRows />}
      {hasNextPage && (
        <SeeMore onPress={() => fetchNextPage()} disabled={isLoading} />
      )}
    </>
  );
};

const Cadenas: React.FC<{
  highlines_ids: string[];
  startDate?: Date;
  endDate?: Date;
}> = ({ highlines_ids, startDate, endDate }) => {
  return (
    <LeaderboardContainer
      rpcFunction="get_total_cadenas"
      queryKey={['entry', highlines_ids, 'cadenas']}
      highlineIds={highlines_ids}
      params={{
        highline_ids: highlines_ids,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
      }}
      entryTransform={(entry, idx, pageIdx) => ({
        name: entry.instagram,
        position: pageIdx * 5 + idx + 1,
        value: entry.total_cadenas.toString(),
        profilePicture: entry.profile_picture,
      })}
    />
  );
};

const Distance: React.FC<{
  highlines_ids: string[];
  startDate?: Date;
  endDate?: Date;
}> = ({ highlines_ids, startDate, endDate }) => {
  return (
    <LeaderboardContainer
      rpcFunction="get_total_walked"
      queryKey={['entry', highlines_ids, 'distance']}
      highlineIds={highlines_ids}
      params={{
        highline_ids: highlines_ids,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
      }}
      entryTransform={(entry, idx, pageIdx) => ({
        name: entry.instagram,
        position: pageIdx * 5 + idx + 1,
        value: `${entry.total_distance_walked}m`,
        profilePicture: entry.profile_picture,
      })}
    />
  );
};

const FullLine: React.FC<{
  highlines_ids: string[];
  startDate?: Date;
  endDate?: Date;
}> = ({ highlines_ids, startDate, endDate }) => {
  return (
    <LeaderboardContainer
      rpcFunction="get_total_full_lines"
      queryKey={['entry', highlines_ids, 'fullLine']}
      highlineIds={highlines_ids}
      params={{
        highline_ids: highlines_ids,
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
      }}
      entryTransform={(entry, idx, pageIdx) => ({
        name: entry.instagram,
        position: pageIdx * 5 + idx + 1,
        value: entry.total_full_lines.toString(),
        profilePicture: entry.profile_picture,
      })}
    />
  );
};

const Speedline: React.FC<{
  highline_id: string;
}> = ({ highline_id }) => {
  return (
    <LeaderboardContainer
      rpcFunction="get_crossing_time"
      queryKey={['entry', highline_id, 'speedline']}
      highlineIds={highline_id}
      params={{
        highline_id,
      }}
      entryTransform={(entry, idx, pageIdx) => {
        if (!entry.crossing_time) return null;
        return {
          name: entry.instagram,
          position: pageIdx * 5 + idx + 1,
          value: transformSecondsToTimeString(entry.crossing_time),
          profilePicture: entry.profile_picture || '',
        };
      }}
    />
  );
};

function transformSecondsToTimeString(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeString = `${padZero(minutes)}:${padZero(seconds)}`;
  return timeString;
}

function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

export { Speedline, Cadenas, Distance, FullLine };
