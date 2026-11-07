import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  LayoutAnimationConfig,
} from 'react-native-reanimated';

import { Button, type ButtonProps } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { cn } from '~/lib/utils';

const AnimatedText = Animated.createAnimatedComponent(Text);
const _labelEntering = FadeInDown.springify().damping(80).stiffness(200);
const _labelExiting = FadeOutUp.springify().damping(80).stiffness(200);

type PrimaryButtonProps = Omit<ButtonProps, 'children' | 'variant' | 'size'> & {
  label: string;
  /** Swaps the label for a spinner and marks the button busy. */
  loading?: boolean;
  /** Extra content pinned inside the button, e.g. a status dot. */
  accessory?: React.ReactNode;
};

/**
 * The main call to action of a screen: a full-width pill with a 17pt
 * semibold label. Label changes cross-fade; the first render doesn't animate.
 */
function PrimaryButton({
  label,
  loading = false,
  accessory,
  disabled,
  className,
  accessibilityLabel,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Button
      variant="default"
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cn(
        'h-14 w-full rounded-full px-6 active:scale-[0.98]',
        // Busy isn't the same as unavailable: keep full contrast while loading.
        loading && 'opacity-100',
        className,
      )}
      {...props}
    >
      <LayoutAnimationConfig skipEntering>
        {loading ? (
          <ActivityIndicator className="text-primary-foreground" />
        ) : (
          <AnimatedText
            key={label}
            numberOfLines={1}
            entering={_labelEntering}
            exiting={_labelExiting}
            className="text-[17px] font-semibold leading-[22px] text-primary-foreground"
          >
            {label}
          </AnimatedText>
        )}
      </LayoutAnimationConfig>
      {accessory}
    </Button>
  );
}

export { PrimaryButton };
export type { PrimaryButtonProps };
