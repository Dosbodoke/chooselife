export const MAP_DEFAULT_EXPERIMENT = 'explore-map-default-v1';
export const MAP_PREFERENCE_KEY = 'preferred_map_type';
export const MAP_ASSIGNMENT_KEY = `experiment:${MAP_DEFAULT_EXPERIMENT}`;

export type MapType = 'satellite' | 'standard';
export type MapVariant = 'control' | 'illustrated';
export type MapAssignment = { variant: MapVariant };
export type MapDefault = { mapType: MapType; assignment: MapAssignment | null };

export interface ExperimentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function isMapType(value: unknown): value is MapType {
  return value === 'satellite' || value === 'standard';
}

function isVariant(value: unknown): value is MapVariant {
  return value === 'control' || value === 'illustrated';
}

/** Persist enrollment separately from an explicit preference, including later toggles. */
export async function resolveMapDefault(
  storage: ExperimentStorage,
  getVariant: () => Promise<unknown>,
): Promise<MapDefault> {
  let preference: MapType | null = null;
  try {
    const savedPreference = await storage.getItem(MAP_PREFERENCE_KEY);
    preference = isMapType(savedPreference) ? savedPreference : null;
    const savedAssignment = await storage.getItem(MAP_ASSIGNMENT_KEY);
    const cached = isVariant(savedAssignment) ? savedAssignment : null;

    // An existing choice is outside a test of defaults. Never overwrite it.
    if (preference && !cached) return { mapType: preference, assignment: null };

    const remote = await getVariant();
    // Missing config, an unavailable flag, and a stopped experiment don't enroll.
    if (!isVariant(remote))
      return { mapType: preference ?? 'standard', assignment: null };

    const variant = cached ?? remote;
    // If persistence fails, don't serve a treatment that could change next visit.
    if (!cached) await storage.setItem(MAP_ASSIGNMENT_KEY, variant);
    return {
      mapType: preference ?? (variant === 'control' ? 'satellite' : 'standard'),
      assignment: { variant },
    };
  } catch {
    return { mapType: preference ?? 'standard', assignment: null };
  }
}
