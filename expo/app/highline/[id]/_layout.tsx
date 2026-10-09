import {
  Redirect,
  Stack,
  useGlobalSearchParams,
  useLocalSearchParams,
  usePathname,
} from 'expo-router';

import { isHighlineUuid, useHighlineIdBySlug } from '~/hooks/use-highline';

import { HighlineNotFound } from '~/components/highline/not-found';
import { HighlineSkeleton } from '~/components/highline/skeleton';

export default function HighlineLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Shared links (https://chooselife.club/highline/<slug>) open here with the
  // slug; every screen below works with the UUID.
  if (id && !isHighlineUuid(id)) {
    return <SlugRedirect slug={id} />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          presentation: 'modal',
          headerShown: false,
          title: '',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          presentation: 'modal',
          headerShown: false,
          title: '',
        }}
      />
      <Stack.Screen
        name="rig"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

function SlugRedirect({ slug }: { slug: string }) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const { id, isPending } = useHighlineIdBySlug(slug);

  if (isPending) {
    return <HighlineSkeleton />;
  }

  if (!id) {
    return <HighlineNotFound />;
  }

  // Keep the sub-route (rig, register, ...) and query params of the link.
  const path = pathname.replace(/^\/highline\/[^/]+/, `/highline/${id}`);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'id') continue;
    for (const v of [value].flat()) {
      if (v !== undefined) search.append(key, v);
    }
  }
  const qs = search.toString();

  // @ts-expect-error: dynamic path string is not assignable to typed Href union
  return <Redirect href={qs ? `${path}?${qs}` : path} />;
}
