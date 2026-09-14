import React from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '~/lib/utils';

import { StyledSquircle } from '~/components/styled';
import { Text } from '~/components/ui/text';

type PlanCardProps = {
  label: string;
  price: string;
  period: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  badge?: string;
};

export function PlanCard({
  label,
  price,
  period,
  selected,
  onPress,
  disabled,
  badge,
}: PlanCardProps) {
  return (
    <View className="relative">
      {badge ? (
        <View className="absolute -top-2.5 right-3 z-10 rounded-full bg-emerald-500 px-2.5 py-1">
          <Text className="text-white text-xs font-bold">{badge}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        disabled={disabled}
        className="active:scale-[0.98]"
      >
        <StyledSquircle
          cornerSmoothing={0.6}
          className={cn(
            'gap-7 rounded-3xl border-2 bg-white/10 p-5',
            selected ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/15',
          )}
        >
          <Text className="text-white text-xl font-bold">{label}</Text>
          <View>
            <Text className="text-white text-3xl font-black">{price}</Text>
            <Text className="text-white/70 text-xs">{period}</Text>
          </View>
        </StyledSquircle>
      </Pressable>
    </View>
  );
}
