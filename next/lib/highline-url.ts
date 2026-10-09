const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Highline routes accept the slug or, for links shared before slugs, the UUID. */
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

/** Public path of a highline page, preferring its readable slug. */
export function highlinePath(highline: { id: string; slug?: string | null }) {
  return `/highline/${highline.slug || highline.id}`;
}
