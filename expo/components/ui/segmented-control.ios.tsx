import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import React from 'react';

import type { SegmentedControlProps } from './segmented-control.types';

export const SEGMENTED_CONTROL_HEIGHT = 32;

/** Native `UISegmentedControl` (SwiftUI segmented `Picker`). */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <Host style={{ height: SEGMENTED_CONTROL_HEIGHT }}>
      <Picker
        selection={value}
        onSelectionChange={(selection) => onChange(selection as T)}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((option) => (
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
