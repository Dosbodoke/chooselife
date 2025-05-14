import * as Linking from 'expo-linking';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect } from 'react';

function useLinking() {
  const router = useRouter();
  const url = Linking.useURL();
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState?.stale !== true;

  // Handle initial URL when app is launched from closed state
  useEffect(() => {
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && isNavigationReady) {
        const parsed = Linking.parse(initialUrl);
        if (parsed.path) {
          router.replace({
            // @ts-expect-error - Can't be strongly typed
            pathname: `${parsed.hostname}${parsed.path ? '/' + parsed.path : ''}`,
            // @ts-expect-error - Can't be strongly typed
            params: parsed.queryParams,
          });
        }
      }
    };

    handleInitialURL();
  }, [isNavigationReady]);

  // Handle URL updates when app is already running
  useEffect(() => {
    if (url && isNavigationReady) {
      const parsed = Linking.parse(url);
      if (parsed.path) {
        router.replace({
          // @ts-expect-error - Can't be strongly typed
          pathname: `${parsed.hostname}${parsed.path ? '/' + parsed.path : ''}`,
          // @ts-expect-error - Can't be strongly typed
          params: parsed.queryParams,
        });
      }
    }
  }, [url, isNavigationReady]);
}

export default useLinking;
