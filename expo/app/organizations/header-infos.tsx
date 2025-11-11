// import { useQuery } from '@tanstack/react-query';
import { CalendarIcon, MapPinIcon, Users } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

// import { supabase } from '~/lib/supabase';

import { Text } from '~/components/ui/text';

// const fetchMemberCount = async (organizationID: string) => {
//   const { count, error } = await supabase
//     .from('organization_members')
//     .select('*', { count: 'exact', head: true })
//     .eq('organization_id', organizationID);

//   if (error) {
//     console.error('Error fetching member count:', error);
//     return 0;
//   }

//   return count || 0;
// };

export const HeaderInfos = () => {
  // const { data: memberCount } = useQuery({
  //   queryKey: ['organizations', slug, 'memberCount'],
  //   queryFn: () => fetchMemberCount(slug),
  //   enabled: !!slug,
  // });

  return (
    <View>
      <View className="flex-row items-center gap-6 my-4">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
            <Users className="text-black" size={20} />
          </View>
          <View>
            <Text className="text-black/70 text-xs font-semibold">Membros</Text>
            <Text className="text-black text-lg font-bold">0</Text>
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
