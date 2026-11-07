import { MapPinIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

type OrganizationHeaderProps = {
  shortName: string;
  fullName: string;
  description: string;
  city: string;
};

export function OrganizationHeader({
  shortName,
  fullName,
  description,
  city,
}: OrganizationHeaderProps) {
  return (
    <View className="gap-4 px-1 pt-2">
      <Text className="text-xs font-bold uppercase tracking-[2px] text-red-700">
        Associação sem fins lucrativos
      </Text>
      <Text
        role="heading"
        aria-level={1}
        className="text-[32px] font-black leading-[36px] tracking-tight text-gray-900"
      >
        {fullName}
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="rounded-md bg-gray-900 px-2 py-0.5">
          <Text className="text-xs font-black tracking-wider text-white">
            {shortName}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Icon as={MapPinIcon} className="size-3.5 text-gray-500" />
          <Text className="text-sm font-medium text-gray-500">{city}</Text>
        </View>
      </View>
      <View className="h-px bg-gray-300" />
      <Text className="text-[17px] leading-7 text-gray-600">{description}</Text>
    </View>
  );
}
