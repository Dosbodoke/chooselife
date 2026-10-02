import React from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';

import type { SegmentedControlProps } from './segmented-control.types';

export const SEGMENTED_CONTROL_HEIGHT = 36;

/** Web fallback; native platforms resolve the `.ios` / `.android` files. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View
      role="tablist"
      className="flex-row bg-gray-200 rounded-full p-1"
      style={{ height: SEGMENTED_CONTROL_HEIGHT }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          onPress={() => onChange(option.value)}
          className={cn(
            'flex-1 items-center justify-center rounded-full',
            option.value === value && 'bg-white shadow-sm',
          )}
        >
          <Text className="text-sm font-semibold">{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
