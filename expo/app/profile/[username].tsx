import { FlashList } from '@shopify/flash-list';
import { QueryData } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { EnduranceIcon, SpeedlineIcon } from '~/lib/icons';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { transformSecondsToTimeString } from '~/utils';
import { Tables } from '~/utils/database.types';

import { SafeAreaOfflineView } from '~/components/offline-banner';
import { SupabaseAvatar } from '~/components/supabase-avatar';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { H2, H3, Lead, Muted, P } from '~/components/ui/typography';

export default function Profile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data: profile, isPending: profilePending } = useQuery({
    queryKey: ['profile', username],
    queryFn: async () => {
      if (!username)
        throw new Error(t('app.profile.[username].errors.noUsernameError'));
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
      if (!profile)
        throw new Error(t('app.profile.[username].errors.profileNotExist'));
      const stats = await supabase
        .rpc('profile_stats', {
          username: `${profile.username}`,
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
    <SafeAreaOfflineView>
      <KeyboardAwareScrollView
        contentContainerClassName="min-h-screen px-2 py-4 gap-4"
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          className="p-2 flex-row items-center rounded-full "
        >
          <LucideIcon name="ChevronLeft" className="text-primary size-6" />
          <Text className="text-primary font-semibold text-xl">{username}</Text>
        </TouchableOpacity>
        <UserHeader profile={profile} />
        <Stats
          total_cadenas={stats?.total_cadenas || 0}
          total_distance_walked={stats?.total_distance_walked || 0}
          total_full_lines={stats?.total_full_lines || 0}
        />
        <LastWalks username={username} />
      </KeyboardAwareScrollView>
    </SafeAreaOfflineView>
  );
}

const UserHeader: React.FC<{
  profile: Tables<'profiles'>;
}> = ({ profile }) => {
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

  return (
    <Card>
      <CardContent className="flex gap-4 overflow-hidden px-2 py-4">
        <View className="flex flex-row mt-4 gap-4">
          <View className="relative overflow-hidden size-16">
            <SupabaseAvatar profileID={profile.id} />
          </View>
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
  const { t } = useTranslation();
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
          <Lead className="text-base">
            {t('app.profile.[username].Stats.walked')}
          </Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <Text className="text-3xl font-extrabold">{total_cadenas}</Text>
          <Lead className="text-base">
            {t('app.profile.[username].Stats.sent')}
          </Lead>
        </View>

        <View className="bg-gray-200 w-px h-full"></View>

        <View className="flex items-center justify-center gap-2">
          <Text className="text-3xl font-extrabold">{total_full_lines}</Text>
          <Lead className="text-base">
            {t('app.profile.[username].Stats.fullLine')}
          </Lead>
        </View>
      </CardContent>
    </Card>
  );
};

const UserNotFound: React.FC<{ username: string }> = ({ username }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaOfflineView className="flex-1">
      <View className="flex items-center justify-center h-full gap-4">
        <H2 className="text-center">
          {t('app.profile.[username].UserNotFound.title', { username })}
        </H2>
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
    </SafeAreaOfflineView>
  );
};

const LastWalks: React.FC<{ username: string }> = ({ username }) => {
  const { t } = useTranslation();

  const entryWithHighlineQuery = supabase
    .from('entry')
    .select(`*, highline (*)`);
  type EntryWithHighline = QueryData<typeof entryWithHighlineQuery>;

  const { data, isPending } = useQuery({
    queryKey: ['profile', username, 'walks'],
    queryFn: async () => {
      const { data } = await entryWithHighlineQuery
        .eq('instagram', username)
        .order('created_at', { ascending: false })
        .limit(5);
      return data;
    },
  });

  // Memoized render function for each walk item.
  const renderWalkItem = React.useCallback(
    ({ item }: { item: EntryWithHighline[number] }) => (
      <View className="py-4">
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
                {t('app.profile.[username].LastWalks.distanceWalked')}
              </Text>
              <Text className="text-primary text-base">
                {item.distance_walked}m
              </Text>
            </View>
          </View>
          {item.crossing_time && (
            <View className="flex-row gap-2">
              <SpeedlineIcon className="text-primary" />
              <View>
                <Text className="text-muted-foreground text-sm">
                  {t('app.profile.[username].LastWalks.bestTime')}
                </Text>
                <Text className="text-primary text-base">
                  {transformSecondsToTimeString(item.crossing_time)}
                </Text>
              </View>
            </View>
          )}
        </View>
        {item.comment && <Text className="text-primary">{item.comment}</Text>}
      </View>
    ),
    [t],
  );

  // Memoized separator to render between items.
  const renderSeparator = React.useCallback(() => {
    return <View className="border-b border-muted" />;
  }, []);

  // Memoized empty state component.
  const renderEmptyComponent = React.useCallback(() => {
    if (isPending) {
      return (
        <View>
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={`walk-loading-${index}`} className="gap-1 py-4">
              <Skeleton className="w-2/5 h-6" />
              <Skeleton className="w-3/6 h-4" />
              <View className="flex-row gap-4 py-1">
                <Skeleton className="w-20 h-14" />
                <Skeleton className="w-20 h-14" />
              </View>
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-3/6 h-4" />
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="items-center py-4">
        <LucideIcon
          name="Frown"
          className="size-40 text-muted-foreground"
          strokeWidth={0.5}
        />
        <Text className="text-center text-muted-foreground">
          {t('app.profile.[username].LastWalks.empty')}
        </Text>
      </View>
    );
  }, [isPending, t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('app.profile.[username].LastWalks.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <FlashList
          data={data}
          renderItem={renderWalkItem}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={renderSeparator}
          ListEmptyComponent={renderEmptyComponent}
          removeClippedSubviews={false}
        />
      </CardContent>
    </Card>
  );
};
