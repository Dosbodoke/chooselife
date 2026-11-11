import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';

/** A short fact or status that wraps as one piece, never mid-phrase. */
export function InventoryChip({
  children,
  leading,
  className,
  textClassName,
}: {
  children: ReactNode;
  /** A dot or icon before the text. */
  leading?: ReactNode;
  className?: string;
  textClassName?: string;
}) {
  return (
    <View
      className={cn(
        'max-w-full flex-row items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5',
        className,
      )}
    >
      {leading}
      <Text
        className={cn('shrink text-xs leading-4 text-slate-600', textClassName)}
      >
        {children}
      </Text>
    </View>
  );
}
