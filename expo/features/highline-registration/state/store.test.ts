import { createRegistrationStateStore } from './store';

type MemoryStorage = {
  value: string | null;
  getItem: jest.Mock<Promise<string | null>, [string]>;
  setItem: jest.Mock<Promise<void>, [string, string]>;
  removeItem: jest.Mock<Promise<void>, [string]>;
};

function createMemoryStorage(): MemoryStorage {
  const storage: MemoryStorage = {
    value: null,
    getItem: jest.fn(async (key: string) => {
      void key;
      return storage.value;
    }),
    setItem: jest.fn(async (_key: string, value: string) => {
      storage.value = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      void key;
      storage.value = null;
    }),
  };
  return storage;
}

describe('highline registration state store', () => {
  it('loads once and serializes reducer writes', async () => {
    const storage = createMemoryStorage();
    const store = createRegistrationStateStore('user-1', storage);
    const listener = jest.fn();
    store.subscribe(listener);

    await store.dispatch({ type: 'start', draftId: 'draft-1', now: 'a' });
    await store.dispatch({
      type: 'place-a',
      position: [-47.93, -15.77],
      now: 'b',
    });

    expect(store.isLoaded()).toBe(true);
    expect(store.getState().activeDraft).toMatchObject({
      draftId: 'draft-1',
      stage: 'place-b',
      anchorA: [-47.93, -15.77],
    });
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalled();
  });

  it('hydrates the persisted active draft for the same user', async () => {
    const firstStorage = createMemoryStorage();
    const firstStore = createRegistrationStateStore('user-1', firstStorage);
    await firstStore.dispatch({
      type: 'start',
      draftId: 'draft-1',
      now: '2026-01-01T00:00:00.000Z',
    });

    const secondStore = createRegistrationStateStore('user-1', firstStorage);
    const hydrated = await secondStore.load();

    expect(hydrated.activeDraft?.draftId).toBe('draft-1');
  });
});
