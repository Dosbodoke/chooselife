import AsyncStorage from 'expo-sqlite/kv-store';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: jest.fn(), setItemSync: jest.fn() },
}));

function loadPreference(saved: string | null) {
  jest.resetModules();
  // The mock factory gets a fresh instance after resetModules.
  const storage = jest.requireMock('expo-sqlite/kv-store')
    .default as typeof AsyncStorage;
  jest.mocked(storage.getItemSync).mockReturnValue(saved);
  const { useWebbingGrouping } = jest.requireActual(
    './use-webbing-grouping',
  ) as typeof import('./use-webbing-grouping');
  return { store: useWebbingGrouping, storage };
}

it('defaults to model and remembers only the selected grouping across store reloads', () => {
  const { store, storage } = loadPreference(null);
  expect(store.getState().grouping).toBe('model');
  store.getState().setGrouping('brand');
  expect(store.getState().grouping).toBe('brand');
  expect(storage.setItemSync).toHaveBeenLastCalledWith(
    'webbing-inventory-grouping-v1',
    'brand',
  );
  expect(loadPreference('brand').store.getState().grouping).toBe('brand');
  expect(loadPreference('none').store.getState().grouping).toBe('none');
});

it('ignores invalid saved preferences and works when device storage is unavailable', () => {
  const { store, storage } = loadPreference('not-a-grouping');
  expect(store.getState().grouping).toBe('model');
  jest.mocked(storage.setItemSync).mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  expect(() => store.getState().setGrouping('type')).not.toThrow();
  expect(store.getState().grouping).toBe('type');
});
