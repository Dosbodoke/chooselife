/// <reference types="jest" />

import { normalizeSlackDataWebbing, type WebbingCatalogSnapshot } from './catalog-snapshot';
import {
  buildWebbingRegistrationRow,
  parseWebbingLength,
  registerWebbing,
  WebbingRegistrationError,
  type StoredWebbingRegistration,
  type WebbingRegistrationInput,
  type WebbingRegistrationRepository,
  type WebbingRegistrationRow,
} from './register-webbing';

const USER = '86000000-0000-4000-8000-000000000101';
const KEY = '86000000-0000-4000-8000-00000000a001';

const normalized = normalizeSlackDataWebbing(
  { id: 1, name: 'Core 2 HS', brand_name: 'Landcruising', material: ['Polyester'] },
  '2026-10-14T12:00:00.000Z',
);
if (!normalized.ok) throw new Error('fixture rejected');
const snapshot: WebbingCatalogSnapshot = normalized.snapshot;

const draft = (overrides: Partial<WebbingRegistrationInput> = {}): WebbingRegistrationInput => ({
  registrationKey: KEY,
  length: '100.5',
  leftLoop: true,
  rightLoop: false,
  tagName: 'Red line',
  note: '',
  strengthClass: null,
  legacyModelId: null,
  catalogSnapshot: snapshot,
  ...overrides,
});

/** In-memory table that enforces the owner/key unique index. */
function fakeRepository() {
  const rows: StoredWebbingRegistration[] = [];
  let nextId = 1;
  const repository = {
    rows,
    findByRegistrationKey: jest.fn(async (userId: string, key: string) => {
      const row = rows.find((r) => r.user_id === userId && r.registration_key === key);
      // Simulate the JSONB round trip, which does not preserve key order.
      return row ? (JSON.parse(JSON.stringify(row)) as StoredWebbingRegistration) : null;
    }),
    insert: jest.fn(async (row: WebbingRegistrationRow) => {
      if (rows.some((r) => r.user_id === row.user_id && r.registration_key === row.registration_key && row.registration_key)) {
        return {
          data: null,
          error: {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "webbing_user_id_registration_key_idx"',
          },
        };
      }
      const stored = { ...row, id: nextId++, image_path: null } as StoredWebbingRegistration;
      rows.push(stored);
      return {
        data: {
          id: stored.id,
          user_id: stored.user_id,
          image_path: null,
          registration_key: stored.registration_key,
        },
        error: null,
      };
    }),
  };
  return repository satisfies WebbingRegistrationRepository;
}

describe('parseWebbingLength', () => {
  it('accepts positive fractional meters and rejects partial or invalid numbers', () => {
    expect(parseWebbingLength('100.5')).toBe(100.5);
    expect(parseWebbingLength(' 20 ')).toBe(20);
    for (const value of ['', '   ', '-3', '0', 'Infinity', '20abc', 'abc', Infinity]) {
      expect(parseWebbingLength(value)).toBeNull();
    }
  });
});

describe('buildWebbingRegistrationRow', () => {
  it('builds the catalog shape with a null legacy model', () => {
    const row = buildWebbingRegistrationRow(USER, draft({ strengthClass: 'B' }));
    expect(row).toEqual({
      user_id: USER,
      registration_key: KEY,
      length: 100.5,
      left_loop: true,
      right_loop: false,
      tag_name: 'Red line',
      description: '',
      strength_class: 'B',
      model: null,
      catalog_snapshot: snapshot,
    });
  });

  it('builds the legacy and manual shapes', () => {
    expect(
      buildWebbingRegistrationRow(USER, draft({ catalogSnapshot: null, legacyModelId: '4' })),
    ).toMatchObject({ model: 4, catalog_snapshot: null });
    expect(
      buildWebbingRegistrationRow(USER, draft({ catalogSnapshot: null, strengthClass: 'A' })),
    ).toMatchObject({ model: null, catalog_snapshot: null, strength_class: 'A' });
  });

  it('rejects conflicting and invalid selections', () => {
    const invalid = (input: WebbingRegistrationInput) => {
      try {
        buildWebbingRegistrationRow(USER, input);
      } catch (error) {
        return error instanceof WebbingRegistrationError && error.code === 'invalid';
      }
      return false;
    };
    expect(invalid(draft({ legacyModelId: 4 }))).toBe(true);
    expect(invalid(draft({ catalogSnapshot: null, legacyModelId: '1.5' }))).toBe(true);
    expect(invalid(draft({ catalogSnapshot: null, legacyModelId: -1 }))).toBe(true);
    expect(invalid(draft({ catalogSnapshot: { ...snapshot, sourceId: 0 } }))).toBe(true);
    expect(invalid(draft({ length: '20abc' }))).toBe(true);
    expect(invalid(draft({ tagName: '  ' }))).toBe(true);
    expect(invalid(draft({ registrationKey: 'not-a-uuid' }))).toBe(true);
  });
});

describe('registerWebbing', () => {
  it('inserts once and recovers the same row on a retry of the same draft', async () => {
    const repository = fakeRepository();
    const first = await registerWebbing({ userId: USER, input: draft(), repository });
    const second = await registerWebbing({ userId: USER, input: draft(), repository });

    expect(first).toEqual({
      webbing: { id: 1, user_id: USER, image_path: null, registration_key: KEY },
      recovered: false,
    });
    expect(second.recovered).toBe(true);
    expect(second.webbing.id).toBe(1);
    expect(repository.insert).toHaveBeenCalledTimes(1);
    expect(repository.rows).toHaveLength(1);
  });

  it('allows two physical items for one upstream model with distinct keys', async () => {
    const repository = fakeRepository();
    const a = await registerWebbing({ userId: USER, input: draft(), repository });
    const b = await registerWebbing({
      userId: USER,
      input: draft({ registrationKey: '86000000-0000-4000-8000-00000000a002', length: 20 }),
      repository,
    });
    expect(a.webbing.id).not.toBe(b.webbing.id);
    expect(repository.rows.map((r) => r.catalog_snapshot)).toEqual([snapshot, snapshot]);
  });

  it('recovers after a lost insert response without inserting twice', async () => {
    const repository = fakeRepository();
    const realInsert = repository.insert.getMockImplementation()!;
    repository.insert.mockImplementationOnce(async (row) => {
      await realInsert(row);
      throw new TypeError('Network request failed');
    });

    const result = await registerWebbing({ userId: USER, input: draft(), repository });
    expect(result.recovered).toBe(true);
    expect(repository.rows).toHaveLength(1);
  });

  it('recovers on the named unique conflict and never overwrites the saved snapshot', async () => {
    const repository = fakeRepository();
    await registerWebbing({ userId: USER, input: draft(), repository });
    // A concurrent attempt raced past the first lookup.
    repository.findByRegistrationKey.mockResolvedValueOnce(null);

    const result = await registerWebbing({ userId: USER, input: draft(), repository });
    expect(result.recovered).toBe(true);
    expect(repository.rows[0].catalog_snapshot).toEqual(snapshot);
  });

  it('reports a draft conflict when the same key was saved with other details', async () => {
    const repository = fakeRepository();
    await registerWebbing({ userId: USER, input: draft(), repository });

    await expect(
      registerWebbing({
        userId: USER,
        input: draft({ catalogSnapshot: { ...snapshot, name: 'Other' } }),
        repository,
      }),
    ).rejects.toMatchObject({ code: 'draft-conflict' });
    await expect(
      registerWebbing({ userId: USER, input: draft({ length: 20 }), repository }),
    ).rejects.toMatchObject({ code: 'draft-conflict' });
    expect(repository.rows[0].catalog_snapshot).toEqual(snapshot);
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('reports unconfirmed and does not insert again when reconciliation fails', async () => {
    const repository = fakeRepository();
    repository.insert.mockImplementationOnce(async () => {
      throw new TypeError('Network request failed');
    });
    repository.findByRegistrationKey
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(
      registerWebbing({ userId: USER, input: draft(), repository }),
    ).rejects.toMatchObject({ code: 'unconfirmed' });

    // The next attempt cannot insert until its lookup succeeds.
    repository.findByRegistrationKey.mockRejectedValueOnce(new TypeError('offline'));
    await expect(
      registerWebbing({ userId: USER, input: draft(), repository }),
    ).rejects.toMatchObject({ code: 'lookup-failed' });
    expect(repository.insert).toHaveBeenCalledTimes(1);
  });

  it('surfaces unrelated database errors without retrying', async () => {
    const repository = fakeRepository();
    repository.insert.mockResolvedValueOnce({
      data: null,
      error: { code: '23514', message: 'violates check constraint' },
    });
    await expect(
      registerWebbing({ userId: USER, input: draft(), repository }),
    ).rejects.toThrow('violates check constraint');
    expect(repository.findByRegistrationKey).toHaveBeenCalledTimes(1);
  });

  it('keeps personal strength for a selected model with no class', async () => {
    const repository = fakeRepository();
    await registerWebbing({
      userId: USER,
      input: draft({ strengthClass: 'A' }),
      repository,
    });
    expect(repository.rows[0].strength_class).toBe('A');
    expect(repository.rows[0].model).toBeNull();
  });
});
