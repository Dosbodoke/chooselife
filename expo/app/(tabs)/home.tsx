import { Image } from 'expo-image';
import { Link } from 'expo-router';
import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';

import { SafeAreaOfflineView } from '~/components/offline-banner';
import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';

export default function HomeScreen() {
  return (
    <SafeAreaOfflineView>
      <ScrollView>
        <BannerCard
          title="APP Chooselife"
          description="Feito para Highliners"
        />

        <View className="flex-1 px-4 py-6">
          <View className="flex-row justify-around mb-8">
            <QuickAction
              icon={<LucideIcon name="PencilRuler" className="text-primary" />}
              label="Simulador de Setup"
            />
            <QuickAction
              icon={<LucideIcon name="Users" className="text-primary" />}
              label="Comunidade"
              isComingSoon
            />
            <QuickAction
              icon={<LucideIcon name="Book" className="text-primary" />}
              label="Aprenda"
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
  onPress?: () => void;
  label: string;
  icon: React.ReactNode;
  isComingSoon?: boolean;
}> = ({ onPress, label, icon, isComingSoon = false }) => {
  return (
    <TouchableOpacity
      className="max-w-24 flex-col items-center gap-1"
      onPress={onPress}
      disabled={isComingSoon}
    >
      {isComingSoon && (
        <View className="absolute -top-1 -right-1 px-1 rounded-md bg-gray-800 z-10">
          <Text style={{ fontSize: 8, color: 'white', fontWeight: 'bold' }}>
            Em breve
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

const BannerCard: React.FC<{
  onPress?: () => void;
  title: string;
  description: string;
}> = ({ onPress, title, description }) => (
  <TouchableOpacity onPress={onPress} className="w-full p-4 pb-0">
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
  return (
    <View className="mb-8">
      <Text className="text-lg font-bold mb-3">🏆 Ranking da Semana</Text>
      <Card className="overflow-hidden">
        <CardContent className="p-4 py-20 bg-primary-foreground items-center">
          <Text className="font-bold">Em breve</Text>
        </CardContent>
      </Card>
    </View>
  );
};

const UpcomingEvents: React.FC = () => (
  <View className="mb-8">
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-lg font-bold">🗓️ Próximos Eventos</Text>
      <Link href="/events">
        <Text className="text-sm text-blue-600">Ver todos</Text>
      </Link>
    </View>
    <View className="gap-3">
      <Card>
        <CardContent className="p-3">
          <View className="flex-row gap-3">
            <View className="flex-col items-center justify-center bg-primary/10 rounded p-2 min-w-[56px]">
              <Text className="text-sm font-bold text-primary">ABR</Text>
              <Text className="text-xl font-bold text-primary">18</Text>
            </View>
            <View className="flex justify-between">
              <Text className="font-medium">Festival Chooselife</Text>
              <View className="items-center flex-row gap-1">
                <LucideIcon
                  name="MapPin"
                  className="size-4 text-muted-foreground"
                />
                <Text className="text-sm text-muted-foreground">
                  Chapada dos Veadeiros, GO
                </Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>
    </View>
  </View>
);
