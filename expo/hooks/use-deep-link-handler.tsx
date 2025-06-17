import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// A list of all locales your app supports, coming from next-intl
const SUPPORTED_LOCALES = ['en', 'pt', 'es'];

export function useDeepLinkHandler() {
  const router = useRouter();

  const handleUrl = (url: string) => {
    if (!url) return;
    const { path } = Linking.parse(url);
    if (!path) return;
    let pathSegments = path.split('/');

    // Check if the first segment of the path is a supported locale.
    if (SUPPORTED_LOCALES.includes(pathSegments[0])) {
      // If it is, remove it from the path segments.
      pathSegments = pathSegments.slice(1);
    }

    // Reconstruct the path without the locale.
    const finalPath = `/${pathSegments.join('/')}`;

    // @ts-expect-error - Dynamic routes need a type override
    router.navigate(finalPath);
  };

  useEffect(() => {
    // This handles the link if the app is closed and opened by the link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    // This handles links when the app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
