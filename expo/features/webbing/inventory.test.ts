import { normalizeSlackDataWebbing } from '@chooselife/ui';

import {
  groupInventory,
  layoutInventory,
  matchesInventorySearch,
  rowStrengthClaims,
  toInventoryEntries,
  totalLength,
  type InventoryEntry,
  type InventoryGroup,
  type InventoryWebbing,
} from './inventory';

function catalog(
  sourceId: number,
  name = 'Path',
  brand: string | null = 'Cong Gear',
  isaClass: string | null = 'A+',
) {
  const result = normalizeSlackDataWebbing(
    { id: sourceId, name, brand_name: brand, isa_class: isaClass },
    '2026-11-11T00:00:00.000Z',
  );
  if (!result.ok) throw new Error('Invalid fixture');
  return result.snapshot;
}

function legacy(modelId: number, name: string, strengthClass?: string) {
  return {
    schemaVersion: 1,
    source: 'chooselife',
    modelId,
    name,
    strengthClass,
    capturedAt: '2026-11-11',
    capturedBy: 'backfill',
  };
}

// The owner's real pieces (IDs 9, 27, 30, 31) plus the awkward cases.
const inventory = toInventoryEntries<InventoryWebbing>([
  { id: 31, length: 50, catalog_snapshot: catalog(260) },
  { id: 30, length: 50, catalog_snapshot: catalog(260) },
  { id: 9, length: 53, legacy_model_snapshot: legacy(7, 'SKY 2.0 3D', 'B') },
  { id: 27, length: 50, legacy_model_snapshot: legacy(3, 'Path', 'A+') },
  {
    id: 36,
    length: 100,
    catalog_snapshot: catalog(260),
    tag_name: 'Path longa',
    strength_class: 'B',
  },
  {
    id: 12,
    length: 80,
    catalog_snapshot: catalog(9001, 'Flow', 'cong gear', 'A'),
    tag_name: 'Cong Gear Flow',
  },
  { id: 45, length: 25, catalog_snapshot: catalog(9004, 'Arc', null, null) },
  { id: 41, length: 30, tag_name: 'Backup', strength_class: 'B' },
  { id: 42, length: 15 },
  { id: 44, length: 60, catalog_snapshot: { schemaVersion: 99 } },
]);

const ids = (entries: InventoryEntry<InventoryWebbing>[]) =>
  entries.map((entry) => entry.webbing.id);
const summary = (groups: InventoryGroup<InventoryWebbing>[]) =>
  groups.map((group) => [group.key, ids(group.entries)]);

describe('toInventoryEntries', () => {
  it('orders physical pieces by ID and keeps only names that say something new', () => {
    expect(ids(inventory)).toEqual([9, 12, 27, 30, 31, 36, 41, 42, 44, 45]);
    const names = Object.fromEntries(
      inventory.map((entry) => [entry.webbing.id, entry.customName]),
    );
    expect(names).toMatchObject({
      12: null,
      30: null,
      36: 'Path longa',
      41: 'Backup',
    });
  });
});

describe('groupInventory', () => {
  it('groups by saved model ID, so same-named models and unknown data stay apart', () => {
    expect(summary(groupInventory(inventory, 'model', 'en-US'))).toEqual([
      ['model:catalog:9004', [45]],
      ['model:catalog:9001', [12]],
      ['model:catalog:260', [30, 31, 36]],
      ['model:legacy:3', [27]],
      ['model:legacy:7', [9]],
      ['model:model', [41, 42]],
      ['model:unsupported-model', [44]],
    ]);
  });

  it('takes brands only from saved catalog data, matching them case-insensitively', () => {
    const groups = groupInventory(inventory, 'brand', 'en-US');
    expect(summary(groups)).toEqual([
      ['brand:cong gear', [12, 30, 31, 36]],
      ['brand:missing', [9, 27, 41, 42, 44, 45]],
    ]);
    expect(groups[0].subject).toEqual({ kind: 'brand', brand: 'cong gear' });
  });

  it('groups by class, keeping model classes apart from owner claims', () => {
    expect(summary(groupInventory(inventory, 'type', 'en-US'))).toEqual([
      ['type:model:a+', [27, 30, 31, 36]],
      ['type:model:a', [12]],
      ['type:model:b', [9]],
      ['type:personal:b', [41]],
      ['type:missing', [42, 44, 45]],
    ]);
  });

  it('lists every piece in one ID-ordered group when ungrouped', () => {
    expect(summary(groupInventory(inventory, 'none', 'en-US'))).toEqual([
      ['all', ids(inventory)],
    ]);
  });
});

describe('rowStrengthClaims', () => {
  const claimsFor = (id: number, grouping: 'model' | 'type' | 'none') => {
    const group = groupInventory(inventory, grouping, 'en-US').find((g) =>
      ids(g.entries).includes(id),
    )!;
    const entry = group.entries.find((e) => e.webbing.id === id)!;
    return rowStrengthClaims(entry, group.subject);
  };

  it('states only what the group heading does not, including conflicting owner claims', () => {
    expect(claimsFor(30, 'model')).toEqual([]);
    expect(claimsFor(36, 'model')).toEqual([
      { strength: 'B', claim: 'personal' },
    ]);
    expect(claimsFor(36, 'type')).toEqual([
      { strength: 'B', claim: 'personal' },
    ]);
    expect(claimsFor(41, 'type')).toEqual([]);
    expect(claimsFor(41, 'model')).toEqual([
      { strength: 'B', claim: 'personal' },
    ]);
    expect(claimsFor(36, 'none')).toEqual([
      { strength: 'A+', claim: 'model' },
      { strength: 'B', claim: 'personal' },
    ]);
  });
});

describe('matchesInventorySearch', () => {
  const search = (query: string) =>
    ids(inventory.filter((entry) => matchesInventorySearch(entry, query)));

  it('matches IDs by prefix, with or without an ID prefix', () => {
    expect(search('3')).toEqual([30, 31, 36]);
    expect(search('ID 30')).toEqual([30]);
    expect(search('#4')).toEqual([41, 42, 44, 45]);
  });

  it('matches every word across model, brand and the owner name, ignoring accents', () => {
    expect(search('cong path')).toEqual([30, 31, 36]);
    expect(search('LONGA')).toEqual([36]);
    expect(search('sky 3d')).toEqual([9]);
    expect(search('  ')).toEqual(ids(inventory));
    expect(
      toInventoryEntries([{ id: 1, length: 1, tag_name: 'Céu' }]).every(
        (entry) => matchesInventorySearch(entry, 'ceu'),
      ),
    ).toBe(true);
    expect(search('nothing like this')).toEqual([]);
  });
});

describe('layoutInventory', () => {
  const groups = groupInventory(inventory, 'model', 'en-US');
  const path = 'model:catalog:260';
  const collapsed = new Set([path, 'model:legacy:7']);

  it('keeps collapsed groups closed until a search reveals their matches', () => {
    const idle = layoutInventory(groups, { query: '', collapsed });
    expect(idle.find((s) => s.group.key === path)).toMatchObject({
      expanded: false,
    });
    expect(idle.find((s) => s.group.key === path)!.matches).toHaveLength(3);

    const searching = layoutInventory(groups, { query: '31', collapsed });
    const shown = searching.filter((s) => s.matches.length);
    expect(shown.map((s) => [s.group.key, ids(s.matches), s.expanded])).toEqual(
      [[path, [31], true]],
    );

    // Clearing the search restores what the owner had collapsed.
    const cleared = layoutInventory(groups, { query: '', collapsed });
    expect(cleared.filter((s) => !s.expanded).map((s) => s.group.key)).toEqual([
      path,
      'model:legacy:7',
    ]);
  });

  it('totals group lengths', () => {
    expect(totalLength(groups.find((g) => g.key === path)!.entries)).toBe(200);
  });
});
