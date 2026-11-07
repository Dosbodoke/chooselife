// PROTOTYPE: "How should the org name + description be laid out?"
// Four variants of the organizations header, switchable via ?variant= on the
// existing (tabs)/organizations route. Throwaway — fold the winner in, then delete.
import SlacStamp from '~/assets/images/slac-cabe-mais.png';
import { Image } from 'expo-image';
import { MapPinIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

import type { PrototypeVariant } from '~/components/prototype-switcher';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export const ORG_HEADER_VARIANTS: PrototypeVariant[] = [
  { key: 'A', name: 'Atual' },
  { key: 'B', name: 'Editorial' },
  { key: 'C', name: 'Selo central' },
  { key: 'D', name: 'Banner + Sobre' },
];

type HeaderProps = {
  shortName: string;
  fullName: string;
  description: string;
  city: string;
};

export function PrototypeOrgHeader({
  variant,
  ...props
}: HeaderProps & { variant: string }) {
  if (variant === 'B') return <VariantB {...props} />;
  if (variant === 'C') return <VariantC {...props} />;
  if (variant === 'D') return <VariantD {...props} />;
  return <VariantA {...props} />;
}

// A — current production header, kept as the baseline.
function VariantA({ shortName, fullName, description }: HeaderProps) {
  return (
    <View className="bg-white rounded-xl p-4 gap-2">
      <View className="flex-1">
        <Text className="text-xl font-bold text-foreground">{shortName}</Text>
        <Text className="text-muted-foreground">{fullName}</Text>
      </View>
      <Text className="text-gray-600 leading-6 mt-2">{description}</Text>
    </View>
  );
}

// B — No card. The full name is the headline; the acronym drops to a tag.
// Eyebrow → headline → meta → lede, like a magazine opener.
function VariantB({ shortName, fullName, description, city }: HeaderProps) {
  return (
    <View className="gap-4 px-1 pt-2">
      <Text className="text-xs font-bold uppercase tracking-[2px] text-red-700">
        Associação sem fins lucrativos
      </Text>
      <Text className="text-[32px] font-black leading-[36px] tracking-tight text-gray-900">
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

// C — Identity-led, centred like a profile. Seal on top, acronym as the
// display name, full name as subtitle, description collapsed to 3 lines.
function VariantC({ shortName, fullName, description }: HeaderProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <View
      className="items-center rounded-2xl bg-white px-6 pb-6 pt-8"
      style={{ borderCurve: 'continuous' }}
    >
      <Image
        source={SlacStamp}
        style={{ width: 96, height: 96 }}
        contentFit="contain"
      />
      <Text className="mt-4 text-4xl font-black tracking-tight text-gray-900">
        {shortName}
      </Text>
      <Text className="mt-1 text-center text-base font-semibold text-gray-500">
        {fullName}
      </Text>
      <View className="my-5 h-1 w-10 rounded-full bg-red-600" />
      <Text
        className="text-center text-[15px] leading-6 text-gray-600"
        numberOfLines={expanded ? undefined : 3}
      >
        {description}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((v) => !v)}
        className="mt-2 px-3 py-1"
      >
        <Text className="text-sm font-bold text-red-700">
          {expanded ? 'Mostrar menos' : 'Ler mais'}
        </Text>
      </Pressable>
    </View>
  );
}

// D — Split identity from "about". A dark banner owns the name (acronym as
// display type, full name beneath); the description moves into its own
// grouped section with an iOS-style section label.
function VariantD({ shortName, fullName, description, city }: HeaderProps) {
  return (
    <View className="gap-6">
      <View
        className="relative min-h-[180px] justify-end overflow-hidden rounded-2xl bg-zinc-900 p-5"
        style={{ borderCurve: 'continuous' }}
      >
        <View
          className="absolute inset-0"
          style={{
            experimental_backgroundImage:
              'radial-gradient(circle at 100% 0%, rgba(220, 38, 38, 0.55) 0%, rgba(24, 24, 27, 0) 65%)',
          }}
        />
        <Image
          source={SlacStamp}
          style={{
            position: 'absolute',
            top: -24,
            right: -36,
            width: 190,
            height: 190,
            transform: [{ rotate: '-12deg' }],
            opacity: 0.35,
          }}
          contentFit="contain"
        />
        <View className="flex-row items-center gap-1 mb-2">
          <Icon as={MapPinIcon} className="size-3.5 text-zinc-400" />
          <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {city}
          </Text>
        </View>
        <Text className="text-5xl font-black tracking-tighter text-white">
          {shortName}
        </Text>
        <Text className="mt-1 text-base font-semibold text-zinc-300">
          {fullName}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="ml-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Sobre
        </Text>
        <View className="rounded-xl bg-white p-4">
          <Text className="text-base leading-6 text-gray-700">
            {description}
          </Text>
        </View>
      </View>
    </View>
  );
}
