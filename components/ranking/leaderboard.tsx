import { cva } from 'class-variance-authority';
import { Link } from 'expo-router';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { SupabaseAvatar } from '../ui/avatar';

interface PodiumProps {
  username: string;
  value: string;
  position: number;
  profilePicture?: string;
}

export const podiumVariants = cva('', {
  variants: {
    size: {
      small: 'p-4 md:p-6',
      large: 'md:p-6 md:py-12 p-4 py-8',
    },
    text: {
      gold: 'text-yellow-500',
      silver: 'text-neutral-500 dark:text-neutral-300',
      bronze: 'text-amber-700',
    },
  },
});

type PodiumVariant = 'gold' | 'silver' | 'bronze';

const RankingPosition = ({ position }: { position: number }) => (
  <View className="flex-row items-center justify-center gap-1">
    <Text className="text-xs text-neutral-400 dark:text-neutral-600">#</Text>
    <Text className="text-sm font-semibold">{position}</Text>
  </View>
);

const Podium = ({ username, value, position, profilePicture }: PodiumProps) => {
  const variant: PodiumVariant =
    position === 1 ? 'gold' : position === 2 ? 'silver' : 'bronze';

  return (
    <Link
      href={{
        pathname: '/profile/[username]',
        params: { username: username },
      }}
      push
      asChild
    >
      <TouchableOpacity className="w-1/3">
        <View className="flex items-center">
          <View className="flex-row w-full items-center justify-center border-b-4 border-neutral-200 dark:border-neutral-600">
            <View
              className={cn('flex w-[96%] flex-col items-center gap-3 py-4')}
            >
              <View className="flex flex-col items-center gap-1">
                <LucideIcon
                  name="Crown"
                  className={cn('size-6', podiumVariants({ text: variant }))}
                />
                <SupabaseAvatar name="" profilePicture={profilePicture} />
              </View>
              <View className="flex flex-col items-center gap-0.5">
                <Text className="text-xs font-normal text-neutral-800 dark:text-neutral-50">
                  {username}
                </Text>
                <Text
                  className={cn('text-xs', podiumVariants({ text: variant }))}
                >
                  {value}
                </Text>
              </View>
            </View>
          </View>
          <View
            className={cn(
              'flex-row w-full items-start justify-center bg-neutral-100 dark:bg-neutral-900/75',
              podiumVariants({
                size: variant === 'gold' ? 'large' : 'small',
              }),
            )}
          >
            <RankingPosition position={position} />
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
};

const LeaderboardRow = ({
  username,
  value,
  position,
  profilePicture,
}: PodiumProps) => (
  <View className="flex-row py-3 items-center gap-2">
    <RankingPosition position={position} />
    <SupabaseAvatar name="" size={12} profilePicture={profilePicture} />
    <Link
      href={{
        pathname: '/profile/[username]',
        params: { username: username },
      }}
      push
      asChild
    >
      <TouchableOpacity className="flex-1 min-w-0">
        <Text className="font-medium text-blue-700 dark:text-blue-500">
          {username}
        </Text>
      </TouchableOpacity>
    </Link>
    <Text className="text-base font-medium">{value}</Text>
  </View>
);

interface LeaderboardProps {
  entries: Array<{
    name: string;
    value: string;
    position: number;
    profilePicture: string;
  } | null>;
}

const Leaderboard = ({ entries }: LeaderboardProps) => (
  <>
    <View className="flex-row items-end justify-center border-t border-neutral-100 bg-center">
      <Podium
        username={entries[1]?.name || ''}
        value={entries[1]?.value || ''}
        position={2}
        profilePicture={entries[1]?.profilePicture}
      />
      <Podium
        username={entries[0]?.name || ''}
        value={entries[0]?.value || ''}
        position={1}
        profilePicture={entries[0]?.profilePicture}
      />
      <Podium
        username={entries[2]?.name || ''}
        value={entries[2]?.value || ''}
        position={3}
        profilePicture={entries[2]?.profilePicture}
      />
    </View>
    <FlatList
      data={entries.slice(3)}
      scrollEnabled={false}
      renderItem={({ item }) =>
        item ? (
          <LeaderboardRow
            username={item.name}
            position={item.position}
            value={item.value}
            profilePicture={item.profilePicture}
          />
        ) : null
      }
      className="divide-y divide-gray-200 dark:divide-gray-700"
    />
  </>
);

export { Leaderboard };
