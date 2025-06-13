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
    const baseRoute = `/highline/${highline.id}/rig` as const;

    if (latestSetup?.is_rigged) {
      return (
        <ActionButton
          text={t('components.highline.history.action.unrig')}
          color="text-red-500"
          onPress={() => {
            if (!session?.user) {
              router.push(`/(modals)/login`);
              return;
            }
            router.setParams({ setupID: latestSetup.id });
          }}
        />
      );
    }

    if (latestSetup?.rig_date && !latestSetup.unrigged_at) {
      const isRigDatePast = new Date(latestSetup.rig_date) < new Date();

      return (
        <ActionButton
          text={t('components.highline.history.action.edit')}
          color="text-amber-500"
          onPress={() => {
            if (isRigDatePast) {
              if (!session?.user) {
                router.push(`/(modals)/login`);
                return;
              }
              router.setParams({ setupID: latestSetup.id });
              return;
            }
            if (!session?.user) {
              router.push(`/(modals)/login?redirect_to=${baseRoute}`);
              return;
            }
            router.push(baseRoute);
          }}
        />
      );
    }

    return (
      <ActionButton
        text={t('components.highline.history.action.rig')}
        color="text-blue-500"
        onPress={() => {
          if (!session?.user) {
            router.push(`/(modals)/login?redirect_to=${baseRoute}`);
            return;
          }
          router.push(baseRoute);
        }}
      />
    );
  }, [latestSetup, session, router, highline.id, t]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold mb-1">
          {t('components.highline.history.title')}
        </CardTitle>
        <CardDescription className="text-sm">
          {t('components.highline.history.description')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <LoadingSkeleton />
        ) : data && data.length > 0 ? (
          <View>
            {data.map((setup, index) => (
              <TimelineItem
                key={setup.id}
                setup={setup}
                isLast={index === data.length - 1}
                isFirst={index === 0}
              />
            ))}
          </View>
        ) : (
          <EmptyState text={t('components.highline.history.empty')} />
        )}
      </CardContent>

      {/* Card Footer with Action Button */}
      {isPending ? (
        <Skeleton className="w-full h-10 rounded-md px-6 py-4 border-t border-border" />
      ) : (
        actionButton
      )}
    </Card>
  );
};

const ActionButton: React.FC<{
  text: string;
  color: string;
  onPress: () => void;
}> = ({ text, color, onPress }) => (
  <TouchableOpacity
    className="px-6 py-4 border-t border-border w-full rounded-lg active:bg-muted"
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text className={cn('text-base font-semibold text-center', color)}>
      {text}
    </Text>
  </TouchableOpacity>
);

const LoadingSkeleton: React.FC = () => (
  <View className="gap-4 my-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <View key={index} className="flex-row gap-3">
        <View className="items-center">
          <Skeleton className="size-3 rounded-full" />
        </View>
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <View className="flex-row gap-1">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </View>
        </View>
      </View>
    ))}
  </View>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <View className="py-8 items-center">
    <LucideIcon name="Frown" className="text-muted-foreground size-12 mb-3" />
    <Text className="text-muted-foreground text-center text-base">{text}</Text>
  </View>
);

const TimelineItem: React.FC<{
  setup: Setup[number];
  isLast: boolean;
  isFirst: boolean;
}> = ({ setup, isLast, isFirst }) => {
  const { t } = useTranslation();
  const rigDate = new Date(setup.rig_date);

  const getTimelineData = () => {
    if (setup.is_rigged) {
      return {
        status: 'rigged' as RigStatuses,
        content: (
          <TimelineContent
            label={t('components.highline.history.timeline.riggedSince')}
            date={rigDate.toLocaleDateString('pt-BR')}
          />
        ),
      };
    }

    if (setup.unrigged_at) {
      return {
        status: 'unrigged' as RigStatuses,
        content: (
          <TimelineContent
            label={t('components.highline.history.timeline.from')}
            date={rigDate.toLocaleDateString('pt-BR')}
            endLabel={t('components.highline.history.timeline.to')}
            endDate={new Date(setup.unrigged_at).toLocaleDateString('pt-BR')}
          />
        ),
      };
    }

    return {
      status: 'planned' as RigStatuses,
      content: (
        <TimelineContent
          label={t('components.highline.history.timeline.plannedFor')}
          date={rigDate.toLocaleDateString('pt-BR')}
        />
      ),
    };
  };

  const { status, content } = getTimelineData();

  const dotStyles: Record<RigStatuses, string> = {
    planned: 'bg-amber-400 border-amber-200',
    rigged: 'bg-green-500 border-green-200',
    unrigged: 'bg-muted border-muted-foreground',
  };

  return (
    <View className="flex-row gap-3">
      {/* Timeline connector */}
      <View className="items-center w-6">
        <View
          className={cn('h-3 w-0.5', isFirst ? 'bg-transparent' : 'bg-border')}
        />
        <View
          className={cn('size-3 rounded-full border-2', dotStyles[status])}
        />
        {!isLast && <View className="flex-1 w-0.5 bg-border mt-1" />}
      </View>

      {/* Content */}
      <View className="flex-1 pb-6">
        <View className="mb-3">{content}</View>
        <Riggers riggers={setup.riggers} />
      </View>
    </View>
  );
};

const TimelineContent: React.FC<{
  label: string;
  date: string;
  endLabel?: string;
  endDate?: string;
}> = ({ label, date, endLabel, endDate }) => (
  <View className="flex-row flex-wrap gap-2 items-center">
    <Text className="text-foreground font-semibold text-base">{label}</Text>
    <CalendarBadge date={date} />
    {endLabel && endDate && (
      <>
        <Text className="text-foreground font-semibold text-base">
          {endLabel}
        </Text>
        <CalendarBadge date={endDate} />
      </>
    )}
  </View>
);

export const Riggers: React.FC<{ riggers: string[] }> = ({ riggers }) => {
  const displayIds = riggers.slice(0, 5);
  const extraCount = riggers.length > 5 ? riggers.length - 5 : 0;

  if (riggers.length === 0) {
    return (
      <View className="flex-row items-center gap-2">
        <LucideIcon name="Users" className="text-muted-foreground size-4" />
        <Text className="text-muted-foreground text-sm">
          No riggers assigned
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center">
      <View className="flex-row mr-2">
        {displayIds.map((id, index) => (
          <View
            key={id}
            style={{ marginLeft: index === 0 ? 0 : -8 }}
            className="border-2 border-background rounded-full shadow-sm"
          >
            <View className="relative overflow-hidden size-9">
              <SupabaseAvatar profileID={id} />
            </View>
          </View>
        ))}

        {extraCount > 0 && (
          <View
            className="flex items-center justify-center rounded-full bg-muted size-9 border-2 border-background shadow-sm"
            style={{ marginLeft: -8 }}
          >
            <Text className="text-xs font-bold text-muted-foreground">
              +{extraCount}
            </Text>
          </View>
        )}
      </View>

      <Text className="text-muted-foreground text-sm">
        {riggers.length} rigger{riggers.length !== 1 ? 's' : ''}
      </Text>
    </View>
  );
};

const CalendarBadge: React.FC<{ date: string }> = ({ date }) => (
  <View className="flex-row gap-1.5 items-center bg-muted border border-border rounded-lg px-2.5 py-1.5 shadow-sm">
    <LucideIcon
      name="CalendarRange"
      className="text-muted-foreground"
      size={14}
    />
    <Text className="text-muted-foreground font-medium text-sm">{date}</Text>
  </View>
);
