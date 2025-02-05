import { useQueries } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Highline } from '~/hooks/use-highline';
import { Setup, useRigSetup, type RigStatuses } from '~/hooks/use-rig-setup';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

import { SupabaseAvatar } from '~/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

export const HighlineHistory: React.FC<{ highline: Highline }> = ({
  highline,
}) => {
  const router = useRouter();
  const { data, latestSetup, isPending } = useRigSetup({
    highlineID: highline.id,
  });

  const actionButton = useMemo(() => {
    if (!latestSetup) {
      return (
        <Link asChild href={`/highline/${highline.id}/rig`}>
          <TouchableOpacity className="p-1">
            <Text className="text-base font-semibold text-blue-500">
              montar
            </Text>
          </TouchableOpacity>
        </Link>
      );
    }

    if (latestSetup.is_rigged) {
      return (
        <TouchableOpacity
          className="p-1"
          onPress={() => {
            router.setParams({ setupID: latestSetup.id });
          }}
        >
          <Text className="text-base font-semibold text-red-500">
            desmontar
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        className="p-1"
        onPress={() => {
          const now = new Date();
          // If rig date is in the past, show modal so the user can confirm if the highline was rigged
          if (new Date(latestSetup.rig_date) < now) {
            router.setParams({ setupID: latestSetup.id });
            return;
          }

          // Otherwise, go to the rig page so the user can edit it.
          router.push(`/highline/${highline.id}/rig`);
        }}
      >
        <Text className="text-base font-semibold text-amber-500">editar</Text>
      </TouchableOpacity>
    );
  }, [latestSetup]);

  return (
    <Card>
      <CardHeader>
        <View className="flex-row justify-between items-center">
          <CardTitle>Histórico de montagem</CardTitle>
          {isPending ? <Skeleton className="w-16 h-4" /> : actionButton}
        </View>
        <CardDescription>
          Registrar a montagem é mais do que manter a história da via, é se
          preocupar com a segurança.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full mb-3" />
            ))}
          </>
        ) : data && data.length > 0 ? (
          data.map((setup, index) => (
            <TimelineItem
              key={setup.id}
              setup={setup}
              isLast={index === data.length - 1}
              isFirst={index === 0}
            />
          ))
        ) : (
          <Text className="text-muted-foreground">
            Nenhum registro de montagem
          </Text>
        )}
      </CardContent>
    </Card>
  );
};

const TimelineItem: React.FC<{
  setup: Setup[number];
  isLast: boolean;
  isFirst: boolean;
}> = ({ setup, isLast, isFirst }) => {
  const rigDate = new Date(setup.rig_date);
  let status: RigStatuses = 'unrigged';
  let content: React.ReactNode = null;

  const dotStyle: Record<RigStatuses, string> = {
    planned: 'bg-amber-300',
    rigged: 'bg-green-500',
    unrigged: 'bg-muted border border-muted-foreground',
  };

  if (setup.is_rigged) {
    status = 'rigged';
    content = (
      <>
        <Text className="text-primary font-semibold text-lg">
          Montada desde
        </Text>
        <CalendarBadge date={rigDate.toLocaleDateString('pt-BR')} />
      </>
    );
  } else if (setup.unrigged_at) {
    status = 'unrigged';
    content = (
      <>
        <Text className="text-primary font-semibold text-lg">De</Text>
        <CalendarBadge date={rigDate.toLocaleDateString('pt-BR')} />
        <Text className="text-primary font-semibold text-lg">até</Text>
        <CalendarBadge
          date={new Date(setup.unrigged_at).toLocaleDateString('pt-BR')}
        />
      </>
    );
  } else {
    status = 'planned';
    content = (
      <>
        <Text className="text-primary font-semibold text-lg">
          Planejado para
        </Text>
        <CalendarBadge date={rigDate.toLocaleDateString('pt-BR')} />
      </>
    );
  }

  return (
    <View className="flex-row gap-2">
      <View className="items-center">
        <View
          className={cn('h-2 w-1', isFirst ? 'bg-transparent' : 'bg-gray-200')}
        />
        <View className={cn('size-3 rounded-full', dotStyle[status])} />
        {!isLast && <View className="flex-1 w-1 bg-gray-200" />}
      </View>

      <View className="pb-6 gap-4">
        <View className="flex-row flex-wrap gap-2 items-center">{content}</View>
        <Riggers riggers={setup.riggers} />
      </View>
    </View>
  );
};

export const Riggers: React.FC<{ riggers: string[] }> = ({ riggers }) => {
  // We'll display the first 5 riggers as individual avatars.
  const displayIds = riggers.slice(0, 5);
  // If there are more than 5, compute how many remain.
  const extraCount = riggers.length > 5 ? riggers.length - 5 : 0;

  // Use useQueries to fetch each profile in parallel.
  const profileQueries = useQueries({
    queries: displayIds.map((id) => ({
      queryKey: ['profile', id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();
        if (error) {
          throw new Error(error.message);
        }
        return data;
      },
      // Mark the data as fresh so that it never refetches automatically.
      staleTime: Infinity,
    })),
  });

  return (
    <View className="flex-row">
      {profileQueries.map((query, index) => {
        // For overlapping, all avatars (except the first) get a negative left margin.
        const marginStyle = { marginLeft: index === 0 ? 0 : -6 };
        // While the query is loading or if data isn’t there, show a fallback.
        if (query.isPending || !query.data) {
          return (
            <View
              key={displayIds[index]}
              style={marginStyle}
              className="border border-background rounded-full"
            >
              <Skeleton className="size-9 rounded-full" />
            </View>
          );
        }
        const profile = query.data;
        return (
          <View
            key={displayIds[index]}
            style={marginStyle}
            className="border border-background rounded-full"
          >
            <SupabaseAvatar
              profilePicture={profile.profile_picture}
              name={profile.name || ''}
              size={9}
            />
          </View>
        );
      })}

      {/* If there are extra riggers, render an extra circle with the count */}
      {extraCount > 0 && (
        <View
          className="flex items-center justify-center rounded-full bg-muted size-9 border border-background"
          style={{ marginLeft: -6 }}
        >
          <Text className="text-xs font-bold">+{extraCount}</Text>
        </View>
      )}
    </View>
  );
};

const CalendarBadge: React.FC<{ date: string }> = ({ date }) => (
  <View
    style={{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 0.1,
      elevation: 5,
    }}
    className="flex-row gap-1 items-center bg-muted border-border rounded-sm px-2"
  >
    <LucideIcon name="CalendarRange" className="text-muted-foreground size-4" />
    <Text className="text-muted-foreground font-semibold">{date}</Text>
  </View>
);
