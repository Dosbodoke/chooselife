import { MinusIcon, PlusIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  FadeOutUp,
} from 'react-native-reanimated';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';

interface Props {
  value: number;
  className?: string;
  onChange: (value: number) => void;
}

function NumberPicker({ value, className, onChange }: Props) {
  const [previousValue, setPreviousValue] = useState(value);

  function handleDecrement() {
    setPreviousValue(value);
    if (value > 0) onChange(value - 1);
  }

  function handleIncrement() {
    setPreviousValue(value);
    onChange(value + 1);
  }

  const enteringAnimation = previousValue > value ? FadeInUp : FadeInDown;
  const exitingAnimation = previousValue > value ? FadeOutDown : FadeOutUp;

  return (
    <View className={cn('flex flex-row items-center gap-3', className)}>
      <TouchableOpacity
        className="size-10 justify-center items-center rounded-lg bg-muted"
        onPress={handleDecrement}
      >
        <Icon as={MinusIcon} className="text-muted-foreground" />
      </TouchableOpacity>
      <View className="size-8 items-center justify-center">
        <Animated.Text
          className="text-foreground text-2xl tabular-nums"
          key={`${value}`}
          entering={enteringAnimation}
          exiting={exitingAnimation}
        >
          {value}
        </Animated.Text>
      </View>
      <TouchableOpacity
        className="size-10 justify-center items-center rounded-lg bg-blue-600 dark:bg-blue-700"
        onPress={handleIncrement}
      >
        <Icon as={PlusIcon} className="text-white" />
      </TouchableOpacity>
    </View>
  );
}

export default NumberPicker;
