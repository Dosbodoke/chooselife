import { useRiggerProfiles, useRigSetup } from '@chooselife/ui';
import { useRouter } from 'expo-router';
import {
  CalendarRangeIcon,
  ChevronRightIcon,
  FrownIcon,
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TouchableOpacity, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { Highline } from '~/hooks/use-highline';
import { cn } from '~/lib/utils';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

import { RiggerAvatars } from './rig-setup-display';
import { RigSetupSheet, useOpenRigSetupSheet } from './rig-setup-sheet';
import {
  splitWebbing,
  STATUS_DOT,
  useRiggerCountLabel,
  useSetupDays,
  type RiggerProfiles,
  type RigSetup,
} from './rig-setup-utils';

export const HighlineHistory: React.FC<{ highline: Highline }> = ({
  highline,
}) => {
  const { t } = useTranslation();
  const { session } = useAuth();
  const router = useRouter();
  const openSetupSheet = useOpenRigSetupSheet();
  const {
    query: { data, isPending },
    latestSetup,
  } = useRigSetup({
    highlineID: highline.id,
  });
  const riggerIDs = useMemo(
    () => (data ?? []).flatMap((setup) => setup.riggers),
    [data],
  );
  const { data: profiles } = useRiggerProfiles(riggerIDs);

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
                profiles={profiles}
                isFirst={index === 0}
                isLast={index === data.length - 1}
                onPress={() => openSetupSheet(setup)}
              />
            ))}
          </View>
        ) : (
          <EmptyState text={t('components.highline.history.empty')} />
        )}
      </CardContent>

      <CardFooter>
        {/* Card Footer with Action Button */}
        {isPending ? (
          <Skeleton className="w-full h-10 rounded-md px-6 py-4 border-t border-border" />
        ) : (
          actionButton
        )}
      </CardFooter>

      <RigSetupSheet
        setups={data}
        profiles={profiles}
        highlineLength={highline.length}
      />
    </Card>
  );
};

const ActionButton: React.FC<{
  text: string;
  color: string;
  onPress: () => void;
}> = ({ text, color, onPress }) => (
  <TouchableOpacity
    className="pt-4 border-t border-border w-full rounded-lg active:bg-muted"
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
    <Icon as={FrownIcon} className="text-muted-foreground size-12 mb-3" />
    <Text className="text-muted-foreground text-center text-base">{text}</Text>
  </View>
);

const TimelineItem: React.FC<{
  setup: RigSetup;
  profiles: RiggerProfiles;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}> = ({ setup, profiles, isFirst, isLast, onPress }) => {
  const { t } = useTranslation();
  const { status, label, dateText } = useSetupDays(setup);
  const riggerCount = useRiggerCountLabel(setup.riggers.length);
  const { mainTotal, backupTotal, hasWebbing } = splitWebbing(setup);

  return (
    <Pressable
      onPress={onPress}
      className="flex-row gap-3 rounded-xl active:bg-muted/60"
    >
      {/* Timeline connector */}
      <View className="items-center w-6">
        <View
          className={cn('h-3 w-0.5', isFirst ? 'bg-transparent' : 'bg-border')}
        />
        <View
          className={cn('size-3 rounded-full border-2', STATUS_DOT[status])}
        />
        {!isLast && <View className="flex-1 w-0.5 bg-border mt-1" />}
      </View>

      {/* Content */}
      <View className="flex-1 gap-2 pb-6">
        <View className="gap-0.5">
          <Text className="text-foreground font-semibold text-base">
            {label}
          </Text>
          {dateText ? (
            <View className="flex-row items-center gap-1.5">
              <Icon
                as={CalendarRangeIcon}
                className="size-3.5 text-muted-foreground"
              />
              <Text className="text-muted-foreground text-sm">{dateText}</Text>
            </View>
          ) : null}
        </View>

        {/* Safety first: what is up there right now, without a tap. */}
        {status === 'rigged' && hasWebbing && (
          <View className="self-start rounded-lg border border-sky-100 bg-sky-50 px-2.5 py-1">
            <Text className="text-sm font-semibold text-sky-700">
              {t('components.highline.history.summary', {
                main: mainTotal,
                backup: backupTotal,
              })}
            </Text>
          </View>
        )}

        <View className="flex-row items-center gap-2">
          {setup.riggers.length > 0 && (
            <RiggerAvatars
              riggers={setup.riggers}
              profiles={profiles}
              size={32}
            />
          )}
          <Text className="text-muted-foreground text-sm">{riggerCount}</Text>
        </View>
      </View>

      <View className="justify-center pb-6">
        <Icon as={ChevronRightIcon} className="size-5 text-muted-foreground" />
      </View>
    </Pressable>
  );
};
