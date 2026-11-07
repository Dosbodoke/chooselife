// PROTOTYPE: floating variant switcher for throwaway UI prototypes.
// Dev-only. Do not merge to main.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react-native';
import React from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

export type PrototypeVariant = { key: string; name: string };

export function usePrototypeVariant(variants: PrototypeVariant[]) {
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  return variants.some((v) => v.key === variant) ? variant! : variants[0].key;
}

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: PrototypeVariant[];
  current: string;
}) {
  const router = useRouter();
  const index = variants.findIndex((v) => v.key === current);

  const go = React.useCallback(
    (step: number) => {
      const next = variants[(index + step + variants.length) % variants.length];
      router.setParams({ variant: next.key });
    },
    [index, router, variants],
  );

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      )
        return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (!__DEV__) return null;

  const active = variants[index];

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 items-center"
      style={{ bottom: 120 }}
    >
      <View
        className="flex-row items-center rounded-full bg-fuchsia-600 px-1 py-1"
        style={{
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        }}
      >
        <Pressable
          accessibilityLabel="Previous variant"
          onPress={() => go(-1)}
          className="size-9 items-center justify-center rounded-full active:bg-white/20"
        >
          <Icon as={ChevronLeftIcon} className="size-5 text-white" />
        </Pressable>
        <Text className="px-2 text-sm font-bold text-white">
          {active.key} · {active.name}
        </Text>
        <Pressable
          accessibilityLabel="Next variant"
          onPress={() => go(1)}
          className="size-9 items-center justify-center rounded-full active:bg-white/20"
        >
          <Icon as={ChevronRightIcon} className="size-5 text-white" />
        </Pressable>
      </View>
    </View>
  );
}
