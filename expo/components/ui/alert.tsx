import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

// 1. Context to share variant data with children (Icon/Text)
const AlertContext = React.createContext<{
  variant: VariantProps<typeof alertVariants>['variant'];
} | null>(null);

// 2. Define Variants using CVA
const alertVariants = cva(
  'relative w-full rounded-xl border px-4 py-3 flex-row items-start gap-3',
  {
    variants: {
      variant: {
        default: 'bg-background border-border',
        destructive: 'border-destructive/30 bg-destructive/5',
        info: 'border-blue-500/30 bg-blue-500/5',
        success: 'border-green-500/30 bg-green-500/5',
        warning: 'border-yellow-500/30 bg-yellow-500/5',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const alertIconVariants = cva('', {
  variants: {
    variant: {
      default: 'text-foreground',
      destructive: 'text-destructive',
      info: 'text-blue-500',
      success: 'text-green-500',
      warning: 'text-yellow-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

// 3. Components
function Alert({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<typeof Animated.View> &
  VariantProps<typeof alertVariants>) {
  return (
    <AlertContext.Provider value={{ variant }}>
      <Animated.View
        entering={FadeInUp.duration(300)}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {children}
      </Animated.View>
    </AlertContext.Provider>
  );
}

function AlertIcon({
  icon: IconComponent,
  className,
  size = 20,
  ...props
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  const { variant } = React.useContext(AlertContext) || { variant: 'default' };

  return (
    <View className="translate-y-0.5">
      <Icon
        as={IconComponent}
        size={size}
        className={cn(alertIconVariants({ variant }), className)}
        {...props}
      />
    </View>
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { variant } = React.useContext(AlertContext) || { variant: 'default' };

  return (
    <Text
      className={cn(
        'mb-1 font-medium leading-none tracking-tight text-foreground',
        variant === 'destructive' && 'text-destructive',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text>) {
  const { variant } = React.useContext(AlertContext) || { variant: 'default' };

  return (
    <Text
      className={cn(
        'text-sm leading-relaxed text-muted-foreground',
        variant === 'destructive' && 'text-destructive/80',
        className,
      )}
      {...props}
    />
  );
}

// Optional: Container to wrap Text content if you want precise alignment
// separate from the Icon, mimicking the web grid layout.
function AlertContent({ className, ...props }: ViewProps) {
  return <View className={cn('flex-1', className)} {...props} />;
}

export { Alert, AlertIcon, AlertTitle, AlertDescription, AlertContent };
