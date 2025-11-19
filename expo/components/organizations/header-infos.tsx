import { useQuery } from '@tanstack/react-query';
import { CalendarIcon, MapPinIcon, Users } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { queryKeys } from '~/lib/query-keys';
import { supabase } from '~/lib/supabase';

import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';

const fetchMemberCount = async (slug: string) => {
  const { count, error } = await supabase
    .from('organization_members')
    .select('*, organizations!inner(*)', { count: 'exact', head: true })
    .eq('organizations.slug', slug);

  if (error) {
    console.error('Error fetching member count:', error);
    return 0;
  }

  return count || 0;
};

export const HeaderInfos = ({ slug }: { slug: string }) => {
  const { data: memberCount, isLoading } = useQuery({
    queryKey: queryKeys.organizations.memberCount(slug),
    queryFn: () => fetchMemberCount(slug),
    enabled: !!slug,
  });

  return (
    <View>
      <View className="flex-row items-center gap-6 my-4">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
            <Users className="text-black" size={20} />
          </View>
          <View>
            <Text className="text-black/70 text-xs font-semibold">Membros</Text>
            {isLoading ? (
              <Skeleton className="h-5 w-12" />
            ) : (
              <Text className="text-black text-lg font-bold">
                {memberCount ?? 0}
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
            <CalendarIcon className="text-black" size={20} />
          </View>
          <View>
            <Text className="text-black/70 text-xs font-semibold">Fundada</Text>
            <Text className="text-black text-lg font-bold">2025</Text>
          </View>
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
          <MapPinIcon className="text-black" size={20} />
        </View>
        <View>
          <Text className="text-black/70 text-xs font-semibold">Sede</Text>
          <Text className="text-black text-lg font-bold">Anápolis</Text>
        </View>
      </View>
    </View>
  );
};
