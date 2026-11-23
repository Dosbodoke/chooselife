import { useIsFocused } from 'expo-router';
import React from 'react';
import { SharedTransitionBoundary } from 'react-native-reanimated';

/**
 * Lets a screen's views with a `sharedTransitionTag` fly to and from other
 * screens. Pass to a navigator's `screenLayout`, and only on the innermost
 * navigators: a boundary around a navigator stays active and hides the ones
 * inside it.
 */
export function ScreenTransitionBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const isFocused = useIsFocused();

  return (
    <SharedTransitionBoundary isActive={isFocused}>
      {children}
    </SharedTransitionBoundary>
  );
}
