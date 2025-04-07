import { Image } from 'expo-image';
import { Link } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { useEvents } from '~/hooks/use-events';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

import { EventCard } from '~/components/event-card';
import { SafeAreaOfflineView } from '~/components/offline-banner';
import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';

const DAMPING = 80;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaOfflineView>
      <ScrollView>
        <BannerCard
          title={t('app.(tabs).home.banner.title')}
          description={t('app.(tabs).home.banner.description')}
        />

        <View className="flex-1 px-4">
          <View className="flex-row justify-around my-6">
            <Link asChild href="/setup-simulator">
              <QuickAction
                icon={
                  <LucideIcon name="PencilRuler" className="text-primary" />
                }
                label={t('app.(tabs).home.quickActions.setupSimulator')}
              />
            </Link>
            <QuickAction
              icon={<LucideIcon name="Users" className="text-primary" />}
              label={t('app.(tabs).home.quickActions.community')}
              isComingSoon
            />
            <QuickAction
              icon={<LucideIcon name="Book" className="text-primary" />}
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

const QuickAction = React.forwardRef<
  React.ElementRef<typeof TouchableOpacity>,
  {
    onPress?: () => void;
    label: string;
    icon: React.ReactNode;
    isComingSoon?: boolean;
  }
>(({ onPress, label, icon, isComingSoon = false }, ref) => {
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
});

const BannerCard: React.FC<{
  onPress?: () => void;
  title: string;
  description: string;
}> = ({ onPress, title, description }) => (
  <TouchableOpacity onPress={onPress} className="w-full p-4">
    <Card>
      <CardContent className="p-0 overflow-hidden rounded-lg bg-slate-200 relative h-40 w-full">
        <Image
          source={
            supabase.storage.from('promo').getPublicUrl('highline-walk.webp')
              .data.publicUrl
          }
          alt="Highline Banner"
          style={{
            flex: 1,
          }}
          contentFit="cover"
        />
        <View className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent justify-end p-4">
          <Text className="text-white font-bold text-xl">{title}</Text>
          <Text className="text-white/90 text-sm">{description}</Text>
        </View>
      </CardContent>
    </Card>
  </TouchableOpacity>
);

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
      <Card className="overflow-hidden">
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
    query: { data: events },
  } = useEvents();

  return (
    <Animated.View layout={_layoutAnimation} className="mb-8">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold">
          {t('app.(tabs).home.sections.UpcomingEvents')}
        </Text>
        <Link href="/events">
          <Text className="text-sm text-blue-600">{t('common.seeAll')}</Text>
        </Link>
      </View>
      <View className="gap-3">
        {events?.slice(0, 2).map((e) => <EventCard key={e.id} event={e} />)}
      </View>
    </Animated.View>
  );
};
