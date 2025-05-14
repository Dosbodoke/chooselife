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
      const { hostname, path, queryParams } = Linking.parse(url);
      if (path)
        router.replace({
          // @ts-expect-error - path can't be strongly typed
          pathname: `${hostname}${path ? '/' + path : ''}`,
          // @ts-expect-error - params can't be strongly typed
          params: queryParams,
        });
    }
  }, [url, isNavigationReady]);
}

export default useLinking;
