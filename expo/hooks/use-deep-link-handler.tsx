import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

// A list of all locales your app supports, coming from next-intl
const SUPPORTED_LOCALES = ['en', 'pt', 'es'];

export function useDeepLinkHandler() {
  const router = useRouter();

  const handleUrl = (url: string) => {
    if (!url) return;

    const parsed = Linking.parse(url);

    // Start with the path from parsed URL
    let pathSegments = [];

    // Add hostname if it's not the main domain
    if (parsed.hostname && parsed.hostname !== 'chooselife.club') {
      pathSegments.push(parsed.hostname);
    }

    // Split the path into individual segments and filter out empty strings
    if (parsed.path) {
      const pathParts = parsed.path
        .split('/')
        .filter((segment) => segment.length > 0);
      pathSegments.push(...pathParts);
    }

    console.log({ pathSegments });

    // Check if the first segment is a supported locale
    if (
      pathSegments.length > 0 &&
      SUPPORTED_LOCALES.includes(pathSegments[0])
    ) {
      // Remove the locale from the path segments
      pathSegments = pathSegments.slice(1);
    }

    const finalPath = `/${pathSegments.join('/')}`;
    // @ts-expect-error - Dynamic routes need a type override
    router.navigate(finalPath);
  };

  useEffect(() => {
    // This handles links when the app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
