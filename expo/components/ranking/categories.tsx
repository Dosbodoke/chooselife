import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  useLeaderboardQuery,
  type LeaderboardFunctions,
  type UseLeaderboardQueryProps,
} from '~/hooks/use-leaderboard';
import { Functions } from '~/utils/database.types';

import { Text } from '../ui/text';
import { Leaderboard } from './leaderboard';
import { LoadingLeaderboard, LoadingRows } from './loading-skeleton';
import SeeMore from './see-more';

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

const LeaderboardContainer = <TFunc extends LeaderboardFunctions>({
  rpcFunction,
  type,
  params,
  entryTransform,
}: LeaderboardContainerProps<TFunc>) => {
  const { t } = useTranslation();
  const {
    data: entries,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useLeaderboardQuery({ rpcFunction, type, params });

  if (isLoading) {
    return <LoadingLeaderboard />;
  }

  if (isError) {
    return (
      <View>
        <Text>{t('components.ranking.categories.error')}</Text>
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
      type="cadenas"
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
      type="distance"
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
      type="fullLine"
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
      type="speedline"
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
