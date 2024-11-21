import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { KeyboardAwareScrollView } from '~/components/KeyboardAwareScrollView';
import { SupabaseAvatar } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { H1, H2, H3, Lead, Muted, P } from '~/components/ui/typography';
import { EnduranceIcon, SpeedlineIcon } from '~/lib/icons';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { transformSecondsToTimeString } from '~/utils';
import { Database } from '~/utils/database.types';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data: profile, isPending: profilePending } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username) throw new Error('No username provided');
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
      return data;
    },
    enabled: !!username,
  });

  const { data: stats } = useQuery({
    queryKey: ['profile', username, 'stats'],
    queryFn: async () => {
      if (!profile) throw new Error("Profile doesn't exists");
      const stats = await supabase
        .rpc('profile_stats', {
          username: `@${profile.username}`,
        })
        .single();

      return stats.data;
    },
    enabled: !!profile,
  });

  if (profilePending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!profile) {
    return <UserNotFound username={username ?? ''} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAwareScrollView
        contentContainerClassName="min-h-screen px-2 py-4 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            className="p-2 rounded-full items-center justify-center"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(tabs)')
            }
          >
            <LucideIcon name="ChevronLeft" className="text-primary size-6" />
          </TouchableOpacity>
          <Text className="text-primary font-semibold text-xl">{username}</Text>
        </View>
        <UserHeader profile={profile} username={`${profile?.username}`} />
        <Stats
          total_cadenas={stats?.total_cadenas || 0}
          total_distance_walked={stats?.total_distance_walked || 0}
          total_full_lines={stats?.total_full_lines || 0}
        />
        <LastWalks username={username} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const UserHeader: React.FC<{
  profile: Database['public']['Tables']['profiles']['Row'] | null;
  username: string;
}> = ({ profile, username }) => {
  function calculateAge(birthday: string) {
    const birthdate = new Date(birthday);
    const today = new Date();

    // Get the difference between today and the user's birthdate
    let age = today.getFullYear() - birthdate.getFullYear();

    // Check if the current month is before the user's birth month,
    // or if it is their birth month but today is earlier than their actual birthday
    if (
      today.getMonth() < birthdate.getMonth() ||
      (today.getMonth() == birthdate.getMonth() &&
        today.getDate() < birthdate.getDate())
    ) {
      age--;
    }

    return age;
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-row gap-4 overflow-hidden px-2 py-4">
          <SupabaseAvatar name={''} profilePicture={''} />
          <View className="flex gap-3">
            <H1>{username}</H1>
            <View className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-500 dark:bg-red-100 dark:text-red-700 md:p-4">
              <Text>Usuário não é verificado</Text>
            </View>
          </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex gap-4 overflow-hidden px-2 py-4">
        <View className="flex flex-row mt-4 gap-4">
          <SupabaseAvatar
            name={profile.name ?? ''}
            profilePicture={profile.profile_picture ?? ''}
          />
          <View className="flex flex-1">
            <H3 numberOfLines={1}>{profile.name}</H3>
            {profile.birthday ? (
              <View className="flex-row gap-1">
                <LucideIcon
                  name="Calendar"
                  className="size-4 text-muted-foreground"
                />
                <Muted>{calculateAge(profile.birthday)}</Muted>
              </View>
            ) : null}
          </View>
        </View>
        <P>{profile.description}</P>
      </CardContent>
    </Card>
  );
};

const Stats: React.FC<{
  total_distance_walked: number;
  total_cadenas: number;
  total_full_lines: number;
}> = ({ total_distance_walked, total_cadenas, total_full_lines }) => {
  const displayDistanceInKM = total_distance_walked > 10000;

  return (
    <Card>
      <CardContent className="flex flex-row justify-evenly items-center px-2 py-4 sm:gap-8">
        <View className="flex items-center justify-center gap-2">
          <View className="flex-row">
            <Text className="text-3xl font-extrabold">
              {displayDistanceInKM
                ? total_distance_walked / 1000
                : total_distance_walked}
            </Text>
            <Text className="text-3xl font-extrabold text-muted-foreground">
              {displayDistanceInKM ? 'km' : 'm'}
            </Text>
          </View>
          <Lead className="text-base">Walked</Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <Text className="text-3xl font-extrabold">{total_cadenas}</Text>
          <Lead className="text-base">Cadenas</Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <Text className="text-3xl font-extrabold">{total_full_lines}</Text>
          <Lead className="text-base">Full lines</Lead>
        </View>
      </CardContent>
    </Card>
  );
};

const UserNotFound: React.FC<{ username: string }> = ({ username }) => {
  const router = useRouter();

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView className="flex-1">
      <View className="flex items-center justify-center h-full gap-4">
        <H2>usuário {username} não existe</H2>
        <Button
          onPress={() => {
            if (canGoBack) {
              router.back();
            }
          }}
        >
          <Text>{canGoBack ? 'Voltar' : 'Ir para página inicial'}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

const LastWalks: React.FC<{ username: string }> = ({ username }) => {
  const { data, isPending } = useQuery({
    queryKey: ['profile', username, 'walks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('entry')
        .select(
          `
            *,
            highline (*)
          `,
        )
        .eq('instagram', `${username}`)
        .order('created_at', { ascending: false })
        .limit(5);
      return data;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ultimos rolês</CardTitle>
      </CardHeader>
      <CardContent>
        <FlashList
          data={data}
          renderItem={({ item, index }) => {
            const isFirstItem = index === 0;
            const isLastItem = data ? index === data.length - 1 : false;

            return (
              <View
                className={cn(
                  isFirstItem ? 'pb-4' : 'py-4',
                  isLastItem ? '' : 'border-b border-muted',
                )}
              >
                <Link href={`/highline/${item.highline_id}`} asChild>
                  <Pressable>
                    <Text className="truncate text-base font-semibold leading-none text-blue-500 dark:text-blue-400">
                      {item.highline?.name}
                    </Text>
                  </Pressable>
                </Link>
                <Text className="text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString('pt-BR', {
                    dateStyle: 'medium',
                  })}
                </Text>
                <View className="flex-row gap-4 py-1">
                  <View className="flex-row gap-2">
                    <EnduranceIcon className="text-primary" />
                    <View>
                      <Text className="text-muted-foreground text-sm">
                        Distância caminhada
                      </Text>
                      <Text className="text-primary text-base">
                        {item.distance_walked}m
                      </Text>
                    </View>
                  </View>
                  {item.crossing_time ? (
                    <View className="flex-row gap-2">
                      <SpeedlineIcon className="text-primary" />
                      <View>
                        <Text className="text-muted-foreground text-sm">
                          Melhor tempo
                        </Text>
                        <Text className="text-primary text-base">
                          {transformSecondsToTimeString(item.crossing_time)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
                {item.comment ? (
                  <Text className="text-primary">{item.comment}</Text>
                ) : null}
              </View>
            );
          }}
          estimatedItemSize={100}
          ListEmptyComponent={() =>
            isPending ? (
              Array.from({ length: 5 }).map((_, index) => {
                const isFirstItem = index === 0;
                const isLastItem = index === 4;

                return (
                  <View
                    key={`walk-loading-${index}`}
                    className={cn(
                      'gap-1',
                      isFirstItem ? 'pb-4' : 'py-4',
                      isLastItem ? '' : 'border-b border-muted',
                    )}
                  >
                    <Skeleton className="w-2/5 h-6" />
                    <Skeleton className="w-3/6 h-4" />
                    <View className="flex-row gap-4 py-1">
                      <Skeleton className="w-20 h-14" />
                      <Skeleton className="w-20 h-14" />
                    </View>
                    <Skeleton className="w-full h-4" />
                    <Skeleton className="w-3/6 h-4" />
                  </View>
                );
              })
            ) : (
              <View className="items-center">
                <LucideIcon
                  name="Frown"
                  className="size-40 text-muted-foreground"
                  strokeWidth={0.5}
                />
                <Text className="text-center text-muted-foreground">
                  Você ainda não deu nenhum rolê
                </Text>
              </View>
            )
          }
        />
      </CardContent>
    </Card>
  );
};
