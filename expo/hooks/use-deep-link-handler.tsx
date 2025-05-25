import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

export function useDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Handle URLs when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url) {
        const parsed = Linking.parse(url);

        // Reconstruct the full path
        const pathSegments = [];
        // Todo: Review if this is really necessary
        if (parsed.hostname && parsed.hostname !== 'chooselife.club')
          pathSegments.push(parsed.hostname);
        if (parsed.path) pathSegments.push(parsed.path);
        const fullPath = `/${pathSegments.join('/')}`;

        // @ts-expect-error - Dynamic routes need type override
        router.navigate(fullPath);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
