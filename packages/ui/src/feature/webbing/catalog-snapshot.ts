import { z } from 'zod';

import {
  parseLegacyModelSnapshot,
  type LegacyModelSnapshot,
} from './legacy-model-snapshot';

// ============================================================================
// SlackData source constants
// ============================================================================

export const SLACKDATA_API_BASE_URL = 'https://slackdata.org/api';
export const SLACKDATA_SITE_URL = 'https://slackdata.org';
export const SLACKDATA_LICENSE_URL =
  'https://creativecommons.org/licenses/by-sa/4.0/' as const;
export const SLACKDATA_ATTRIBUTION =
  'Gear data from SlackData by the International Slackline Association, CC BY-SA 4.0';

export const WEBBING_CATALOG_SCHEMA_VERSION = 1 as const;
export const WEBBING_CATALOG_NORMALIZATION_VERSION = 1 as const;

/** Fixed upstream detail URL for a SlackData webbing. Never user-supplied. */
export function getSlackDataWebbingUrl(sourceId: number): string {
  return `${SLACKDATA_API_BASE_URL}/webbing/${sourceId}`;
}

// ============================================================================
// Saved snapshot schema
// ============================================================================

const HTTP_URL = /^https?:\/\/[^\s]+$/i;

const nullableText = (max: number) => z.string().min(1).max(max).nullable();
const positiveNumber = z.number().finite().positive().nullable();
const stretchPoint = z.object({
  kn: z.number().finite().nonnegative(),
  percent: z.number().finite().nonnegative(),
});

/**
 * The normalized, user-selected catalog details saved with one physical
 * webbing. Only these keys are stored; unknown upstream fields are dropped.
 * It deliberately carries no recommended lifetime.
 */
export const webbingCatalogSnapshotSchema = z
  .object({
    schemaVersion: z.literal(WEBBING_CATALOG_SCHEMA_VERSION),
    source: z.literal('slackdata'),
    gearType: z.literal('webbing'),
    sourceId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceUrl: z.string(),
    retrievedAt: z.string().datetime(),
    attribution: z.string().min(1).max(500),
    licenseUrl: z.literal(SLACKDATA_LICENSE_URL),
    normalizationVersion: z.literal(WEBBING_CATALOG_NORMALIZATION_VERSION),
    name: z.string().trim().min(1).max(200),
    brandName: nullableText(200),
    version: nullableText(100),
    materials: z.array(z.string().min(1).max(64)).min(1).max(10).nullable(),
    construction: nullableText(64),
    widthMm: positiveNumber,
    thicknessMm: positiveNumber,
    weightGramsPerMeter: positiveNumber,
    breakingStrengthKn: positiveNumber,
    stretch: z.array(stretchPoint).min(1).max(100).nullable(),
    productUrl: z.string().max(2048).regex(HTTP_URL).nullable(),
    active: z.boolean().nullable(),
    isaCertified: z.boolean().nullable(),
    isaClass: nullableText(32),
    isaCertificate: nullableText(500),
    isaWarning: nullableText(2000),
    manufacturerNotForHighline: z.boolean().nullable(),
    manufacturerNotForHighlineSource: nullableText(2000),
  })
  .refine((value) => value.sourceUrl === getSlackDataWebbingUrl(value.sourceId), {
    message: 'sourceUrl must be the fixed SlackData detail URL',
    path: ['sourceUrl'],
  });

export type WebbingCatalogSnapshot = z.infer<typeof webbingCatalogSnapshotSchema>;

/**
 * Parse a stored snapshot. Never throws: unknown future versions and invalid
 * values are reported as unsupported (null) instead of being cast.
 */
export function parseWebbingCatalogSnapshot(
  value: unknown,
): WebbingCatalogSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) return null;
  const result = webbingCatalogSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}

// ============================================================================
// Upstream record normalization
// ============================================================================

export type NormalizeWebbingResult =
  | { ok: true; snapshot: WebbingCatalogSnapshot; degradedFields: string[] }
  | { ok: false; reason: 'not-object' | 'invalid-id' | 'invalid-name' | 'schema' };

type RawRecord = Record<string, unknown>;

/**
 * Turn one SlackData `/webbing/` record into a snapshot. Missing values stay
 * null; malformed optional values become null and are listed by field name
 * (never by value) in `degradedFields`. A missing id or name rejects the row.
 */
export function normalizeSlackDataWebbing(
  raw: unknown,
  retrievedAt: string,
): NormalizeWebbingResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'not-object' };
  }
  const record = raw as RawRecord;
  const id = record.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    return { ok: false, reason: 'invalid-id' };
  }
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name || name.length > 200) return { ok: false, reason: 'invalid-name' };

  const degraded: string[] = [];
  const text = (field: string, max: number) => {
    const value = record[field];
    if (value === null || value === undefined) return null;
    const asText =
      typeof value === 'string'
        ? value.trim()
        : typeof value === 'number' && Number.isFinite(value)
          ? String(value)
          : undefined;
    if (asText === undefined || asText.length > max) {
      degraded.push(field);
      return null;
    }
    return asText || null;
  };
  const measure = (field: string) => {
    const value = record[field];
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
    degraded.push(field);
    return null;
  };
  const flag = (field: string) => {
    const value = record[field];
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    degraded.push(field);
    return null;
  };

  const snapshot = {
    schemaVersion: WEBBING_CATALOG_SCHEMA_VERSION,
    source: 'slackdata' as const,
    gearType: 'webbing' as const,
    sourceId: id,
    sourceUrl: getSlackDataWebbingUrl(id),
    retrievedAt,
    attribution: SLACKDATA_ATTRIBUTION,
    licenseUrl: SLACKDATA_LICENSE_URL,
    normalizationVersion: WEBBING_CATALOG_NORMALIZATION_VERSION,
    name,
    brandName: text('brand_name', 200),
    version: text('version', 100),
    materials: normalizeMaterials(record.material, degraded),
    construction: text('webbing_construction', 64),
    widthMm: measure('width'),
    thicknessMm: measure('thickness'),
    weightGramsPerMeter: measure('weight'),
    breakingStrengthKn: measure('breaking_strength'),
    stretch: normalizeStretch(record.stretch, degraded),
    productUrl: normalizeHttpUrl(record.product_url, degraded),
    active: flag('active'),
    isaCertified: flag('isa_certified'),
    isaClass: text('isa_class', 32),
    isaCertificate: text('isa_certificate', 500),
    isaWarning: text('isa_warning', 2000),
    manufacturerNotForHighline: flag('manufacturer_not_for_highline'),
    manufacturerNotForHighlineSource: text(
      'manufacturer_not_for_highline_source',
      2000,
    ),
  };

  const parsed = webbingCatalogSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return { ok: false, reason: 'schema' };
  return { ok: true, snapshot: parsed.data, degradedFields: degraded };
}

function normalizeMaterials(value: unknown, degraded: string[]) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) {
    degraded.push('material');
    return null;
  }
  // A Set dedupes while keeping first-seen order.
  const materials = new Set<string>();
  for (const entry of value) {
    const material = typeof entry === 'string' ? entry.trim() : '';
    if (!material || material.length > 64) {
      degraded.push('material');
      continue;
    }
    materials.add(material);
  }
  return materials.size ? [...materials].slice(0, 10) : null;
}

function normalizeStretch(value: unknown, degraded: string[]) {
  if (value === null || value === undefined || value === '') return null;
  let points: unknown = value;
  if (typeof value === 'string') {
    try {
      points = JSON.parse(value);
    } catch {
      degraded.push('stretch');
      return null;
    }
  }
  if (!Array.isArray(points) || points.length === 0 || points.length > 100) {
    degraded.push('stretch');
    return null;
  }
  const result: { kn: number; percent: number }[] = [];
  for (const point of points) {
    const parsed = stretchPoint.safeParse(point);
    if (!parsed.success) {
      degraded.push('stretch');
      return null;
    }
    result.push({ kn: parsed.data.kn, percent: parsed.data.percent });
  }
  return result;
}

function normalizeHttpUrl(value: unknown, degraded: string[]) {
  if (value === null || value === undefined || value === '') return null;
  const url = typeof value === 'string' ? value.trim() : '';
  if (url.length > 2048 || !HTTP_URL.test(url)) {
    degraded.push('product_url');
    return null;
  }
  return url;
}

/** True only for absolute http(s) URLs; used before opening external links. */
export function isSafeExternalUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.length <= 2048 && HTTP_URL.test(url);
}

// ============================================================================
// Resolved display
// ============================================================================

export interface WebbingSpecsInput {
  catalog_snapshot?: unknown;
  legacy_model_snapshot?: unknown;
  strength_class?: string | null;
}

export type ResolvedWebbingSpecs = {
  /**
   * `catalog`: a valid saved SlackData snapshot. `unsupported`: a snapshot is
   * stored but this build cannot read it. `legacy`: the frozen details of a
   * retired Choose Life model.
   */
  source: 'catalog' | 'unsupported' | 'legacy' | 'unknown';
  catalog: WebbingCatalogSnapshot | null;
  legacyModel: LegacyModelSnapshot | null;
  modelName: string | null;
  materials: string[] | null;
  construction: string | null;
  /** Strength class from the catalog or legacy model, with its origin. */
  modelStrengthClass: { value: string; origin: 'slackdata' | 'legacy' } | null;
  /** Strength class the owner entered; never a certification. */
  personalStrengthClass: string | null;
  /** Only the legacy model ever carries a supported lifetime. */
  recommendedLifetimeDays: number | null;
  legacyImagePath: string | null;
};

export function resolveWebbingSpecs(webbing: WebbingSpecsInput): ResolvedWebbingSpecs {
  const personalStrengthClass = webbing.strength_class ?? null;
  const hasSnapshot =
    webbing.catalog_snapshot !== null && webbing.catalog_snapshot !== undefined;
  const catalog = hasSnapshot
    ? parseWebbingCatalogSnapshot(webbing.catalog_snapshot)
    : null;

  if (catalog) {
    return {
      source: 'catalog',
      catalog,
      legacyModel: null,
      modelName: formatCatalogModelName(catalog),
      materials: catalog.materials,
      construction: catalog.construction,
      modelStrengthClass: catalog.isaClass
        ? { value: catalog.isaClass, origin: 'slackdata' }
        : null,
      personalStrengthClass,
      recommendedLifetimeDays: null,
      legacyImagePath: null,
    };
  }

  const legacyModel = parseLegacyModelSnapshot(webbing.legacy_model_snapshot);
  if (legacyModel) {
    return {
      source: 'legacy',
      catalog: null,
      legacyModel,
      modelName: legacyModel.name,
      materials: legacyModel.material ? [legacyModel.material] : null,
      construction: legacyModel.weave ?? null,
      modelStrengthClass: legacyModel.strengthClass
        ? { value: legacyModel.strengthClass, origin: 'legacy' }
        : null,
      personalStrengthClass,
      recommendedLifetimeDays: legacyModel.recommendedLifetimeDays ?? null,
      legacyImagePath: legacyModel.imagePath ?? null,
    };
  }

  return {
    source: hasSnapshot ? 'unsupported' : 'unknown',
    catalog: null,
    legacyModel: null,
    modelName: null,
    materials: null,
    construction: null,
    modelStrengthClass: null,
    personalStrengthClass,
    recommendedLifetimeDays: null,
    legacyImagePath: null,
  };
}

/** "Brand Model Version", skipping unknown parts. */
export function formatCatalogModelName(
  snapshot: Pick<WebbingCatalogSnapshot, 'brandName' | 'name' | 'version'>,
): string {
  return [snapshot.brandName, snapshot.name, snapshot.version]
    .filter(Boolean)
    .join(' ');
}

/**
 * User label first, then the saved catalog name, then the legacy model name.
 * Returns null so callers can apply their translated "unknown" label.
 */
export function getWebbingDisplayName(
  webbing: (WebbingSpecsInput & { tag_name?: string | null }) | null | undefined,
): string | null {
  if (!webbing) return null;
  if (webbing.tag_name) return webbing.tag_name;
  const snapshot = parseWebbingCatalogSnapshot(webbing.catalog_snapshot);
  if (snapshot) return formatCatalogModelName(snapshot);
  return parseLegacyModelSnapshot(webbing.legacy_model_snapshot)?.name ?? null;
}
