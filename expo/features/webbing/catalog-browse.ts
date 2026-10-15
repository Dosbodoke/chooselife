import type { WebbingCatalogSnapshot } from '@chooselife/ui';

// Sorting, filtering and summary values for the picker. Pure, no React.

export type CatalogSortKey =
  | 'brand'
  | 'strength'
  | 'width'
  | 'weight'
  | 'stretch';
export type CatalogSort = { key: CatalogSortKey; desc: boolean };

/** Order shown in the sort menu, with each key's first-pick direction. */
export const CATALOG_SORT_OPTIONS: { key: CatalogSortKey; desc: boolean }[] = [
  { key: 'brand', desc: false },
  { key: 'strength', desc: true },
  { key: 'width', desc: true },
  { key: 'weight', desc: false },
  { key: 'stretch', desc: false },
];

export const DEFAULT_CATALOG_SORT: CatalogSort = { key: 'brand', desc: false };

/** Picking the active key flips direction; another key uses its default. */
export function nextCatalogSort(
  current: CatalogSort,
  key: CatalogSortKey,
): CatalogSort {
  if (current.key === key) return { key, desc: !current.desc };
  const option = CATALOG_SORT_OPTIONS.find((o) => o.key === key);
  return { key, desc: option?.desc ?? false };
}

/** Elongation at 10 kN when recorded, else the nearest recorded load. */
export function stretchReference(model: WebbingCatalogSnapshot) {
  if (!model.stretch?.length) return null;
  return model.stretch.reduce((best, point) =>
    Math.abs(point.kn - 10) < Math.abs(best.kn - 10) ? point : best,
  );
}

function sortValue(model: WebbingCatalogSnapshot, key: CatalogSortKey) {
  switch (key) {
    case 'strength':
      return model.breakingStrengthKn;
    case 'width':
      return model.widthMm;
    case 'weight':
      return model.weightGramsPerMeter;
    case 'stretch':
      return stretchReference(model)?.percent ?? null;
    default:
      return null;
  }
}

/**
 * Sort a copy. Brand order is the catalog's own brand/name order. Unknown
 * values always go last regardless of direction; ties keep catalog order.
 */
export function sortCatalogItems(
  items: WebbingCatalogSnapshot[],
  sort: CatalogSort,
): WebbingCatalogSnapshot[] {
  if (sort.key === 'brand') return sort.desc ? [...items].reverse() : items;
  return items
    .map((item, index) => ({ item, index, value: sortValue(item, sort.key) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) {
        if (a.value === b.value) return a.index - b.index;
        return a.value === null ? 1 : -1;
      }
      const diff = sort.desc ? b.value - a.value : a.value - b.value;
      return diff || a.index - b.index;
    })
    .map(({ item }) => item);
}

export type CatalogFilter =
  | { kind: 'isa-certified' }
  | { kind: 'in-production' }
  | { kind: 'material'; material: string };

export function catalogFilterId(filter: CatalogFilter) {
  return filter.kind === 'material'
    ? `material:${filter.material}`
    : filter.kind;
}

/** Filters offered for a catalog: status filters, then materials present. */
export function availableCatalogFilters(
  items: WebbingCatalogSnapshot[],
): CatalogFilter[] {
  const materials = [...new Set(items.flatMap((m) => m.materials ?? []))].sort(
    (a, b) => a.localeCompare(b),
  );
  return [
    { kind: 'isa-certified' },
    { kind: 'in-production' },
    ...materials.map((material) => ({ kind: 'material' as const, material })),
  ];
}

/**
 * Every active filter must match. Unknown status never matches "ISA
 * certified"; only an explicit discontinued flag fails "in production".
 */
export function applyCatalogFilters(
  items: WebbingCatalogSnapshot[],
  filters: CatalogFilter[],
): WebbingCatalogSnapshot[] {
  if (!filters.length) return items;
  return items.filter((model) =>
    filters.every((filter) => {
      switch (filter.kind) {
        case 'isa-certified':
          return model.isaCertified === true;
        case 'in-production':
          return model.active !== false;
        case 'material':
          return (model.materials ?? []).includes(filter.material);
      }
    }),
  );
}

export type CatalogFlag =
  | { kind: 'isa'; isaClass: string | null }
  | { kind: 'isa-warning'; text: string }
  | { kind: 'not-for-highline' }
  | { kind: 'discontinued' };

/** Status badges, most safety-relevant first. Null values add nothing. */
export function catalogFlags(model: WebbingCatalogSnapshot): CatalogFlag[] {
  const flags: CatalogFlag[] = [];
  if (model.isaWarning)
    flags.push({ kind: 'isa-warning', text: model.isaWarning });
  if (model.manufacturerNotForHighline === true) {
    flags.push({ kind: 'not-for-highline' });
  }
  if (model.isaCertified === true) {
    flags.push({ kind: 'isa', isaClass: model.isaClass });
  }
  if (model.active === false) flags.push({ kind: 'discontinued' });
  return flags;
}
