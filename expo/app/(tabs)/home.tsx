import HighlineWalkImage from '~/assets/images/highline-walk.webp';
import { Link } from 'expo-router';
import {
  BookIcon,
  CalendarIcon,
  PencilRulerIcon,
  UsersIcon,
} from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useEvents } from '~/hooks/use-events';
import { cn } from '~/lib/utils';

import { EventCard, EventCardSkeleton } from '~/components/event-card';
import { SafeAreaOfflineView } from '~/components/offline-banner';
import { Card, CardContent } from '~/components/ui/card';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';
import { Widget } from '~/components/widget';

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaOfflineView>
      <ScrollView contentContainerClassName="pt-8">
        <Widget
          items={[
            {
              id: 'chooselife',
              title: t('app.(tabs).home.banner.title'),
              subtitle: t('app.(tabs).home.banner.description'),
              background: HighlineWalkImage,
            },
          ]}
        />

        <View className="flex-1 px-4 mt-4">
          <View className="flex-row justify-around my-6">
            <Link asChild href="/setup-simulator">
              <QuickAction
                icon={<Icon as={PencilRulerIcon} className="text-primary" />}
                label={t('app.(tabs).home.quickActions.setupSimulator')}
              />
            </Link>
            <QuickAction
              icon={<Icon as={BookIcon} className="text-primary" />}
              label={t('app.(tabs).home.quickActions.learn')}
              isComingSoon
            />
          </View>

          <UpcomingEvents />
          <Ranking />
        </View>
      </ScrollView>
    </SafeAreaOfflineView>
  );
}

const QuickAction: React.FC<{
  ref?: React.RefObject<View | null>;
  onPress?: () => void;
  label: string;
  icon: React.ReactNode;
  isComingSoon?: boolean;
}> = ({ ref, onPress, label, icon, isComingSoon = false }) => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      ref={ref}
      className="max-w-24 flex-col items-center gap-1"
      onPress={onPress}
      disabled={isComingSoon}
    >
      {isComingSoon && (
        <View className="absolute -top-1 -right-1 rounded-md bg-gray-800 z-10 p-1 px-2">
          <Text className="font-bold text-white text-[8px]">
            {t('common.soon')}
          </Text>
        </View>
      )}
      <View
        className={cn(
          'items-center justify-center border border-input bg-background h-14 w-14 rounded-md',
          isComingSoon ? 'opacity-50' : 'opacity-100',
        )}
      >
        {icon}
      </View>
      <Text className="text-xs text-center font-medium">{label}</Text>
    </TouchableOpacity>
  );
};

// const FeaturedSpot: React.FC = () => {
//   return (
//     <View className="mb-8">
//       <Text className="text-lg font-bold mb-3">Featured Spot</Text>
//       <Card className="overflow-hidden">
//         <View className="relative h-48 w-full">
//           <Image
//             source={{
//               uri: 'https://via.placeholder.com/400x200.png?text=Featured+Spot',
//             }}
//             className="absolute top-0 left-0 right-0 bottom-0 w-full h-full"
//             contentFit="cover"
//           />
//         </View>
//         <CardContent className="p-4">
//           <Text className="font-bold">Yosemite Valley Highline</Text>
//           <Text className="text-sm text-muted-foreground mb-2">
//             California, USA
//           </Text>
//           <View className="flex-row items-center gap-1 text-sm">
//             <Text className="font-medium">Difficulty:</Text>
//             <Text className="text-orange-500">Advanced</Text>
//           </View>
//         </CardContent>
//       </Card>
//     </View>
//   );
// };

const Ranking: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Animated.View layout={_layoutAnimation} className="mb-8">
      <Text className="text-lg font-bold mb-3">
        {t('app.(tabs).home.sections.Ranking')}
      </Text>
      <Card className="overflow-hidden py-0">
        <CardContent className="p-4 py-20 bg-primary-foreground items-center">
          <Text className="font-bold">{t('common.soon')}</Text>
        </CardContent>
      </Card>
    </Animated.View>
  );
};

const UpcomingEvents: React.FC = () => {
  const { t } = useTranslation();
  const {
    query: { data: events, isPending },
  } = useEvents();

  return (
    <Animated.View layout={_layoutAnimation} className="mb-8">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold">
          {t('app.(tabs).home.sections.UpcomingEvents.title')}
        </Text>
        <Link href="/events" asChild>
          <TouchableOpacity>
            <Text className="text-sm text-blue-600">{t('common.seeAll')}</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <View className="gap-3">
        {isPending ? (
          <>
            <EventCardSkeleton />
            <EventCardSkeleton />
          </>
        ) : events && events.length > 0 ? (
          events.slice(0, 2).map((e) => <EventCard key={e.id} event={e} />)
        ) : (
          <View className="rounded-lg border border-gray-200 p-6 items-center justify-center">
            <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
              <Icon as={CalendarIcon} className="text-primary" />
            </View>
            <Text className="text-base font-medium text-gray-900 mb-1">
              {t('app.(tabs).home.sections.UpcomingEvents.noEventsTitle')}
            </Text>
            <Text className="text-sm text-gray-500 text-center mb-4">
              {t('app.(tabs).home.sections.UpcomingEvents.noEventsDescription')}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};
