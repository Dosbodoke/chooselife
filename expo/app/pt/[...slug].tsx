import { Redirect, useLocalSearchParams } from 'expo-router';

export default function PtLocaleRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string[] }>();
  const redirectPath = `/${Array.isArray(slug) ? slug.join('/') : slug || ''}`;

  // @ts-expect-error: dynamic path string is not assignable to typed Href union
  return <Redirect href={redirectPath} />;
}
