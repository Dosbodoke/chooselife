import * as Linking from 'expo-linking';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

// Handle linking
function useLinking() {
  const router = useRouter();
  const url = Linking.useURL();
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState
    ? rootNavigationState.stale !== true
    : false;

  useEffect(() => {
    if (url && isNavigationReady) {
      const { path } = Linking.parse(url);
      // @ts-expect-error - path can't be strongly typed
      if (path) router.push(path);
    }
  }, [url, isNavigationReady]);
}

export default useLinking;
