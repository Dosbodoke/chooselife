import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EsLocaleRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string[] }>();
  const redirectPath = `/${Array.isArray(slug) ? slug.join('/') : slug || ''}`;

  return <Redirect href={redirectPath} />;
}
