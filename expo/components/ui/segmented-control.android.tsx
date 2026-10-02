import {
  Host,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import React from 'react';

import type { SegmentedControlProps } from './segmented-control.types';

export const SEGMENTED_CONTROL_HEIGHT = 40;

// Neutral colors so it matches the iOS control instead of the Material seed.
const colors = {
  activeContainerColor: '#E4E4E7',
  activeContentColor: '#09090B',
  activeBorderColor: '#D4D4D8',
  inactiveContainerColor: 'transparent',
  inactiveContentColor: '#3F3F46',
  inactiveBorderColor: '#D4D4D8',
};

/** Material 3 single-choice segmented button row. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <Host style={{ height: SEGMENTED_CONTROL_HEIGHT }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {options.map((option) => (
          <SegmentedButton
            key={option.value}
            selected={option.value === value}
            onClick={() => onChange(option.value)}
            colors={colors}
          >
            <SegmentedButton.Label>
              <Text>{option.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
