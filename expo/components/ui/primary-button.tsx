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

const TONES = {
  /** Dark pill for light surfaces. */
  default: { button: '', label: 'text-primary-foreground' },
  /** Light pill for dark surfaces, e.g. a hero card. */
  inverse: { button: 'bg-white active:bg-gray-100', label: 'text-black' },
} as const;

type PrimaryButtonProps = Omit<ButtonProps, 'children' | 'variant' | 'size'> & {
  label: string;
  /** Swaps the label for a spinner and marks the button busy. */
  loading?: boolean;
  /** Extra content pinned inside the button, e.g. a status dot. */
  accessory?: React.ReactNode;
  tone?: keyof typeof TONES;
};

/**
 * The main call to action of a screen: a full-width pill with a 17pt
 * semibold label. Label changes cross-fade; the first render doesn't animate.
 */
function PrimaryButton({
  label,
  loading = false,
  accessory,
  tone = 'default',
  disabled,
  className,
  accessibilityLabel,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const colors = TONES[tone];

  return (
    <Button
      variant="default"
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={cn(
        'h-14 w-full rounded-full px-6 active:scale-[0.98]',
        colors.button,
        // Busy isn't the same as unavailable: keep full contrast while loading.
        loading && 'opacity-100',
        className,
      )}
      {...props}
    >
      <LayoutAnimationConfig skipEntering>
        {loading ? (
          <ActivityIndicator className={colors.label} />
        ) : (
          <AnimatedText
            key={label}
            numberOfLines={1}
            entering={_labelEntering}
            exiting={_labelExiting}
            className={cn(
              'text-[17px] font-semibold leading-[22px]',
              colors.label,
            )}
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
