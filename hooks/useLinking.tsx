import * as Linking from "expo-linking";
import { useEffect } from "react";
import { useRootNavigationState, useRouter } from "expo-router";

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
      const { path, queryParams, hostname, scheme } = Linking.parse(url);
      if (path) router.push(path);
    }
  }, [url, isNavigationReady]);
}

export default useLinking;
