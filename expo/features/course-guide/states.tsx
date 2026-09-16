import {
  ArrowLeftIcon,
  BookOpenIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
  WifiOffIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Icon } from '~/components/ui/icon';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

import { CourseGuideCover } from './cover';

type Action = () => void;

export function CourseGuideLoadingState() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center bg-[#ecebe7] px-6 pb-20 pt-6">
      <Animated.View
        entering={FadeIn.duration(180)}
        className="h-full w-full max-w-sm gap-6 bg-white px-8 py-10"
        style={{ boxShadow: '0 3px 16px rgba(0,0,0,0.08)' }}
      >
        <Skeleton className="h-3 w-28 rounded-full" />
        <View className="gap-3">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-8/12 rounded-lg" />
        </View>
        <Skeleton className="h-1 w-12 rounded-full" />
        <View className="gap-3 pt-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-11/12 rounded-full" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-8/12 rounded-full" />
        </View>
        <Skeleton className="mt-3 h-36 w-full rounded-2xl" />
      </Animated.View>

      <View
        className="absolute bottom-6 flex-row items-center gap-2 rounded-full bg-black/75 px-4 py-2.5"
        pointerEvents="none"
      >
        <ActivityIndicator size="small" colorClassName="accent-white" />
        <Text className="text-sm font-medium text-white" selectable>
          {t('app.learn.loading')}
        </Text>
      </View>
    </View>
  );
}

export function CourseGuideLockedState({ onBack }: { onBack: Action }) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-[#d8d6cf]">
      <CourseGuideCover />
      <View className="absolute inset-0 bg-black/10" pointerEvents="none" />

      <StateSheet
        icon={LockKeyholeIcon}
        title={t('app.learn.lockedTitle')}
        description={t('app.learn.lockedDescription')}
      >
        <SecondaryAction
          icon={ArrowLeftIcon}
          label={t('app.learn.backHome')}
          onPress={onBack}
        />
      </StateSheet>
    </View>
  );
}

type CourseGuideErrorStateProps = {
  description: string;
  onRetry: Action;
  title: string;
};

export function CourseGuideErrorState({
  description,
  onRetry,
  title,
}: CourseGuideErrorStateProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-[#d8d6cf]">
      <CourseGuideCover />
      <View className="absolute inset-0 bg-black/15" pointerEvents="none" />

      <StateSheet icon={BookOpenIcon} title={title} description={description}>
        <PrimaryAction
          icon={RefreshCwIcon}
          label={t('app.learn.retry')}
          onPress={onRetry}
        />
      </StateSheet>
    </View>
  );
}

type CourseGuideCenteredStateProps = {
  action?: { label: string; onPress: Action };
  description: string;
  kind: 'offline' | 'sign-in';
  title: string;
};

export function CourseGuideCenteredState({
  action,
  description,
  kind,
  title,
}: CourseGuideCenteredStateProps) {
  const icon = kind === 'offline' ? WifiOffIcon : BookOpenIcon;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow items-center justify-center px-8 pb-10"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Animated.View
        entering={FadeInUp.duration(220)}
        className="w-full max-w-sm items-center gap-5"
      >
        <View className="size-16 items-center justify-center rounded-full bg-muted">
          <Icon as={icon} size={28} className="text-foreground" />
        </View>
        <View className="items-center gap-2">
          <Text
            className="text-center text-2xl font-semibold tracking-tight"
            selectable
          >
            {title}
          </Text>
          <Text
            className="text-center leading-6 text-muted-foreground"
            selectable
          >
            {description}
          </Text>
        </View>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            className="h-12 w-full items-center justify-center rounded-xl bg-primary px-5 active:opacity-80"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="font-semibold text-primary-foreground">
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </ScrollView>
  );
}

type StateSheetProps = {
  children: React.ReactNode;
  description: string;
  icon: typeof BookOpenIcon;
  title: string;
};

function StateSheet({ children, description, icon, title }: StateSheetProps) {
  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      className="absolute inset-x-3 bottom-3 gap-5 rounded-3xl bg-background p-6"
      style={{
        borderCurve: 'continuous',
        boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
      }}
    >
      <View className="flex-row items-start gap-4">
        <View className="size-12 items-center justify-center rounded-2xl bg-muted">
          <Icon as={icon} size={22} className="text-foreground" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-xl font-semibold tracking-tight" selectable>
            {title}
          </Text>
          <Text className="leading-5 text-muted-foreground" selectable>
            {description}
          </Text>
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

type StateActionProps = {
  icon: typeof BookOpenIcon;
  label: string;
  onPress: Action;
};

function PrimaryAction({ icon, label, onPress }: StateActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-5 active:opacity-80"
      style={{ borderCurve: 'continuous' }}
    >
      <Icon as={icon} size={18} className="text-primary-foreground" />
      <Text className="font-semibold text-primary-foreground">{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ icon, label, onPress }: StateActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 active:bg-muted"
      style={{ borderCurve: 'continuous' }}
    >
      <Icon as={icon} size={18} className="text-foreground" />
      <Text className="font-semibold">{label}</Text>
    </Pressable>
  );
}
