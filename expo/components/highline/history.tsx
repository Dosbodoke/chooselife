import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { Highline } from '~/hooks/use-highline';
import {
  useRigSetup,
  type RigStatuses,
  type Setup,
} from '~/hooks/use-rig-setup';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { SupabaseAvatar } from '~/components/supabase-avatar';
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
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const {
    query: { data, isPending },
    latestSetup,
  } = useRigSetup({
    highlineID: highline.id,
  });

  const actionButton = useMemo(() => {
    if (latestSetup?.is_rigged) {
      return (
        <TouchableOpacity
          className="p-1"
          onPress={() => {
            if (!session?.user) {
              router.push(`/(modals)/login`);
              return;
            }
            router.setParams({ setupID: latestSetup.id });
          }}
        >
          <Text className="text-base font-semibold text-red-500">
            {t('components.highline.history.action.unrig')}
          </Text>
        </TouchableOpacity>
      );
    }

    if (latestSetup?.rig_date && !latestSetup.unrigged_at) {
      return (
        <TouchableOpacity
          className="p-1"
          onPress={() => {
            // If rig date is in the past, show modal so the user can confirm if the highline was rigged
            const now = new Date();
            if (new Date(latestSetup.rig_date) < now) {
              if (!session?.user) {
                router.push(`/(modals)/login`);
                return;
              }
              router.setParams({ setupID: latestSetup.id });
              return;
            }
            const route = `/highline/${highline.id}/rig` as const;
            if (!session?.user) {
              router.push(`/(modals)/login?redirect_to=${route}`);
              return;
            }
            // Otherwise, go to the rig page so the user can edit it.
            router.push(route);
          }}
        >
          <Text className="text-base font-semibold text-amber-500">
            {t('components.highline.history.action.edit')}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        className="p-1"
        onPress={() => {
          const route = `/highline/${highline.id}/rig` as const;
          if (!session?.user) {
            router.push(`/(modals)/login?redirect_to=${route}`);
            return;
          }
          router.push(route);
        }}
      >
        <Text className="text-base font-semibold text-blue-500">
          {t('components.highline.history.action.rig')}
        </Text>
      </TouchableOpacity>
    );
  }, [latestSetup, session, router, highline.id, t]);

  return (
    <Card>
      <CardHeader>
        <View className="flex-row justify-between items-center">
          <CardTitle>{t('components.highline.history.title')}</CardTitle>
          {isPending ? <Skeleton className="w-16 h-4" /> : actionButton}
        </View>
        <CardDescription>
          {t('components.highline.history.description')}
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
            {t('components.highline.history.empty')}
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
  const { t } = useTranslation();
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
          {t('components.highline.history.timeline.riggedSince')}
        </Text>
        <CalendarBadge date={rigDate.toLocaleDateString('pt-BR')} />
      </>
    );
  } else if (setup.unrigged_at) {
    status = 'unrigged';
    content = (
      <>
        <Text className="text-primary font-semibold text-lg">
          {t('components.highline.history.timeline.from')}
        </Text>
        <CalendarBadge date={rigDate.toLocaleDateString('pt-BR')} />
        <Text className="text-primary font-semibold text-lg">
          {t('components.highline.history.timeline.to')}
        </Text>
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
          {t('components.highline.history.timeline.plannedFor')}
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

  return (
    <View className="flex-row">
      {displayIds.map((id, index) => {
        const marginStyle = { marginLeft: index === 0 ? 0 : -6 };

        return (
          <View
            key={id}
            style={marginStyle}
            className="border border-background rounded-full"
          >
            <View className="overflow-hidden size-9">
              <SupabaseAvatar profileID={id} />
            </View>
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
