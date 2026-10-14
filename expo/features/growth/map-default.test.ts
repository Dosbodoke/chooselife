import {
  MAP_ASSIGNMENT_KEY,
  MAP_PREFERENCE_KEY,
  resolveMapDefault,
} from './map-default';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe('map default experiment', () => {
  it.each([
    ['control', 'satellite'],
    ['illustrated', 'standard'],
  ])(
    'serves and persists %s for an eligible installation',
    async (variant, mapType) => {
      const store = storage();
      expect(await resolveMapDefault(store, async () => variant)).toEqual({
        mapType,
        assignment: { variant },
      });
      expect(store.setItem).toHaveBeenCalledWith(MAP_ASSIGNMENT_KEY, variant);
    },
  );

  it('excludes an existing preference without evaluating the flag', async () => {
    const remote = jest.fn();
    expect(
      await resolveMapDefault(
        storage({ [MAP_PREFERENCE_KEY]: 'satellite' }),
        remote,
      ),
    ).toEqual({
      mapType: 'satellite',
      assignment: null,
    });
    expect(remote).not.toHaveBeenCalled();
  });

  it('keeps the original assignment even if the remote allocation changes', async () => {
    const store = storage({ [MAP_ASSIGNMENT_KEY]: 'control' });
    expect(await resolveMapDefault(store, async () => 'illustrated')).toEqual({
      mapType: 'satellite',
      assignment: { variant: 'control' },
    });
  });

  it('keeps a later manual choice in the original cohort', async () => {
    const store = storage({
      [MAP_ASSIGNMENT_KEY]: 'control',
      [MAP_PREFERENCE_KEY]: 'standard',
    });
    expect(await resolveMapDefault(store, async () => 'control')).toEqual({
      mapType: 'standard',
      assignment: { variant: 'control' },
    });
  });

  it.each([false, undefined, true, 'unexpected'])(
    'does not enroll on %s, even with a cached assignment',
    async (value) => {
      expect(
        await resolveMapDefault(
          storage({ [MAP_ASSIGNMENT_KEY]: 'control' }),
          async () => value,
        ),
      ).toEqual({
        mapType: 'standard',
        assignment: null,
      });
    },
  );

  it('keeps a manual choice when the experiment is stopped', async () => {
    expect(
      await resolveMapDefault(
        storage({
          [MAP_ASSIGNMENT_KEY]: 'control',
          [MAP_PREFERENCE_KEY]: 'satellite',
        }),
        async () => false,
      ),
    ).toEqual({ mapType: 'satellite', assignment: null });
  });

  it('fails safely when assignment storage cannot persist', async () => {
    const store = storage();
    store.setItem.mockRejectedValue(new Error('disk full'));
    expect(await resolveMapDefault(store, async () => 'control')).toEqual({
      mapType: 'standard',
      assignment: null,
    });
  });

  it('does not treat a corrupt stored assignment as enrollment', async () => {
    const store = storage({
      [MAP_ASSIGNMENT_KEY]: 'garbage',
      [MAP_PREFERENCE_KEY]: 'satellite',
    });
    expect(await resolveMapDefault(store, async () => 'illustrated')).toEqual({
      mapType: 'satellite',
      assignment: null,
    });
  });

  it('falls back if loading the flag fails', async () => {
    expect(
      await resolveMapDefault(storage(), async () => {
        throw new Error('offline');
      }),
    ).toEqual({ mapType: 'standard', assignment: null });
  });
});
