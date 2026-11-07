/**
 * PROTOTYPE tooling: a floating pill that cycles UI variants on a screen.
 * The active variant lives in the `?variant=` route param, so a deep link
 * like `<scheme>://home?variant=B` opens straight into it. Dev builds only.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useFloatingTabBarHeight } from '~/components/floating-tab-bar';
import { Icon } from '~/components/ui/icon';

export type PrototypeVariant<K extends string> = { key: K; name: string };

export function usePrototypeVariant<K extends string>(
  variants: readonly PrototypeVariant<K>[],
) {
  const router = useRouter();
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  const current =
    variants.find((v) => v.key === variant)?.key ?? variants[0].key;

  const setVariant = (key: K) => router.setParams({ variant: key });
  return [current, setVariant] as const;
}

export function PrototypeSwitcher<K extends string>({
  variants,
  current,
  onChange,
}: {
  variants: readonly PrototypeVariant<K>[];
  current: K;
  onChange: (key: K) => void;
}) {
  const tabBarHeight = useFloatingTabBarHeight();
  if (!__DEV__) return null;

  const index = variants.findIndex((v) => v.key === current);
  const step = (delta: number) => {
    const next = (index + delta + variants.length) % variants.length;
    onChange(variants[next].key);
  };

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 items-center"
      style={{ bottom: tabBarHeight + 4 }}
    >
      <View
        className="flex-row items-center rounded-full bg-amber-300 p-1"
        style={{
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
          borderCurve: 'continuous',
        }}
      >
        <Pressable
          accessibilityLabel="Previous variant"
          onPress={() => step(-1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-black/10 active:bg-black/20"
        >
          <Icon as={ChevronLeftIcon} size={18} color="#000" />
        </Pressable>
        <View className="min-w-[150px] items-center px-3">
          <Text className="text-[9px] font-bold uppercase tracking-widest text-black/60">
            Prototype · {index + 1}/{variants.length}
          </Text>
          <Text className="text-[13px] font-semibold text-black">
            {current} ({variants[index].name})
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Next variant"
          onPress={() => step(1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-black/10 active:bg-black/20"
        >
          <Icon as={ChevronRightIcon} size={18} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}
