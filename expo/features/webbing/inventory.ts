import {
  resolveWebbingSpecs,
  type ResolvedWebbingSpecs,
  type WebbingSpecsInput,
} from '@chooselife/ui';

export const WEBBING_GROUPINGS = ['model', 'brand', 'type', 'none'] as const;
export type WebbingGrouping = (typeof WEBBING_GROUPINGS)[number];
export const isWebbingGrouping = (value: unknown): value is WebbingGrouping =>
  WEBBING_GROUPINGS.some((grouping) => grouping === value);

export type InventoryWebbing = WebbingSpecsInput & {
  id: number;
  length: number;
  tag_name?: string | null;
};

export type InventoryEntry<T extends InventoryWebbing> = {
  webbing: T;
  specs: ResolvedWebbingSpecs;
  /** The owner's name for the piece, unless it only repeats the model name. */
  customName: string | null;
};

/** A strength class and who claims it; an owner's claim is never a certification. */
export type StrengthClaim = { strength: string; claim: 'model' | 'personal' };

/** What a group is about. Unknown data gets an explicit `missing` group. */
export type InventoryGroupSubject =
  | { kind: 'model'; specs: ResolvedWebbingSpecs }
  | { kind: 'brand'; brand: string }
  | ({ kind: 'class' } & StrengthClaim)
  | {
      kind: 'missing';
      field: 'model' | 'unsupported-model' | 'brand' | 'class';
    }
  | { kind: 'all' };

export type InventoryGroup<T extends InventoryWebbing> = {
  key: string;
  subject: InventoryGroupSubject;
  entries: InventoryEntry<T>[];
};

/** Case-, accent- and spacing-insensitive text for keys and search. */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Inventory entries sorted by ID, the mark on the physical piece. */
export function toInventoryEntries<T extends InventoryWebbing>(
  webbings: T[],
): InventoryEntry<T>[] {
  return webbings
    .map((webbing) => {
      const specs = resolveWebbingSpecs(webbing);
      const name = webbing.tag_name?.trim() || null;
      const repeatsModel =
        !!name && !!specs.modelName && fold(name) === fold(specs.modelName);
      return { webbing, specs, customName: repeatsModel ? null : name };
    })
    .sort((a, b) => a.webbing.id - b.webbing.id);
}

const CLASS_ORDER = ['a+', 'a', 'b', 'c'];
const classRank = (strength: string) => {
  const rank = CLASS_ORDER.indexOf(fold(strength));
  return rank < 0 ? CLASS_ORDER.length : rank;
};

type Placement = {
  key: string;
  subject: InventoryGroupSubject;
  /** Known groups first, then each kind of missing data. */
  tier: number;
  label: string;
};

function place(
  { specs }: InventoryEntry<InventoryWebbing>,
  grouping: WebbingGrouping,
): Placement {
  if (grouping === 'none')
    return { key: 'all', subject: { kind: 'all' }, tier: 0, label: '' };

  if (grouping === 'model') {
    // Stable saved IDs, never names or lengths: two models can share a name.
    const id = specs.catalog
      ? `catalog:${specs.catalog.sourceId}`
      : specs.legacyModel
        ? `legacy:${specs.legacyModel.modelId}`
        : null;
    if (id)
      return {
        key: `model:${id}`,
        subject: { kind: 'model', specs },
        tier: 0,
        label: specs.modelName ?? '',
      };
    const field =
      specs.source === 'unsupported' ? 'unsupported-model' : 'model';
    return {
      key: `model:${field}`,
      subject: { kind: 'missing', field },
      tier: field === 'model' ? 1 : 2,
      label: '',
    };
  }

  if (grouping === 'brand') {
    // Only saved catalog data has a brand; legacy models never recorded one.
    const brand = specs.catalog?.brandName?.trim();
    return brand
      ? {
          key: `brand:${fold(brand)}`,
          subject: { kind: 'brand', brand },
          tier: 0,
          label: brand,
        }
      : {
          key: 'brand:missing',
          subject: { kind: 'missing', field: 'brand' },
          tier: 1,
          label: '',
        };
  }

  // A model's class wins the group; an owner's differing claim shows on the row.
  const claim: StrengthClaim | null = specs.modelStrengthClass
    ? { strength: specs.modelStrengthClass.value, claim: 'model' }
    : specs.personalStrengthClass
      ? { strength: specs.personalStrengthClass, claim: 'personal' }
      : null;
  if (!claim)
    return {
      key: 'type:missing',
      subject: { kind: 'missing', field: 'class' },
      tier: 2,
      label: '',
    };
  return {
    key: `type:${claim.claim}:${fold(claim.strength)}`,
    subject: { kind: 'class', ...claim },
    tier: claim.claim === 'model' ? 0 : 1,
    label: claim.strength,
  };
}

export function groupInventory<T extends InventoryWebbing>(
  entries: InventoryEntry<T>[],
  grouping: WebbingGrouping,
  locale: string,
): InventoryGroup<T>[] {
  const placed = new Map<
    string,
    Placement & { entries: InventoryEntry<T>[] }
  >();
  for (const entry of entries) {
    const placement = place(entry, grouping);
    const group = placed.get(placement.key) ?? { ...placement, entries: [] };
    group.entries.push(entry);
    placed.set(placement.key, group);
  }
  return [...placed.values()]
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (grouping === 'type' ? classRank(a.label) - classRank(b.label) : 0) ||
        a.label.localeCompare(b.label, locale, {
          sensitivity: 'base',
          numeric: true,
        }) ||
        a.key.localeCompare(b.key),
    )
    .map(({ key, subject, entries }) => ({ key, subject, entries }));
}

/**
 * The strength claims a row must state itself: every claim on the piece
 * except the one its group heading already shows.
 */
export function rowStrengthClaims(
  { specs }: InventoryEntry<InventoryWebbing>,
  subject: InventoryGroupSubject,
): StrengthClaim[] {
  const model = specs.modelStrengthClass?.value;
  const personal = specs.personalStrengthClass;
  const claims: StrengthClaim[] = [];
  if (model) claims.push({ strength: model, claim: 'model' });
  if (personal && (!model || fold(personal) !== fold(model)))
    claims.push({ strength: personal, claim: 'personal' });
  return claims.filter(
    ({ strength, claim }) =>
      !(subject.kind === 'model' && claim === 'model') &&
      !(
        subject.kind === 'class' &&
        subject.claim === claim &&
        fold(subject.strength) === fold(strength)
      ),
  );
}

/**
 * A number (optionally "ID 30" or "#30") matches IDs by prefix. Any other
 * text must match every word across model, brand and the owner's name.
 */
export function matchesInventorySearch(
  { webbing, specs }: InventoryEntry<InventoryWebbing>,
  query: string,
) {
  const search = fold(query);
  if (!search) return true;
  const id = /^(?:id ?|#)?(\d+)$/.exec(search)?.[1];
  if (id) return String(webbing.id).startsWith(id);
  const text = fold(
    [specs.modelName, specs.catalog?.brandName, webbing.tag_name]
      .filter(Boolean)
      .join(' '),
  );
  return search.split(' ').every((word) => text.includes(word));
}

export type InventorySection<T extends InventoryWebbing> = {
  group: InventoryGroup<T>;
  /** Entries the search keeps; every entry when not searching. */
  matches: InventoryEntry<T>[];
  expanded: boolean;
};

/**
 * Search runs over every entry regardless of grouping or collapse, and shows
 * matching groups expanded without touching `collapsed`, so clearing the
 * search brings back exactly what the owner had collapsed.
 */
export function layoutInventory<T extends InventoryWebbing>(
  groups: InventoryGroup<T>[],
  { query, collapsed }: { query: string; collapsed: ReadonlySet<string> },
): InventorySection<T>[] {
  const searching = !!fold(query);
  return groups.map((group) => ({
    group,
    matches: group.entries.filter((entry) =>
      matchesInventorySearch(entry, query),
    ),
    expanded: searching || !collapsed.has(group.key),
  }));
}

export const totalLength = (entries: InventoryEntry<InventoryWebbing>[]) =>
  entries.reduce((sum, { webbing }) => sum + webbing.length, 0);
