import AsyncStorage from 'expo-sqlite/kv-store';
import { useCallback, useSyncExternalStore } from 'react';

import { useMountEffect } from '~/hooks/use-mount-effect';

import {
  createEmptyRegistrationState,
  HighlineRegistrationState,
} from './model';
import {
  loadRegistrationState,
  RegistrationStorage,
  saveRegistrationState,
} from './persistence';
import { RegistrationAction, registrationReducer } from './reducer';

export type RegistrationStateListener = (
  state: HighlineRegistrationState,
) => void;

export type RegistrationStateStore = {
  getState: () => HighlineRegistrationState;
  isLoaded: () => boolean;
  load: () => Promise<HighlineRegistrationState>;
  dispatch: (action: RegistrationAction) => Promise<HighlineRegistrationState>;
  subscribe: (listener: RegistrationStateListener) => () => void;
};

type RegistrationStoreEntry = {
  storage: RegistrationStorage;
  store: RegistrationStateStore;
};

const registrationStores = new Map<string, RegistrationStoreEntry>();

/**
 * A small async store for screens and queue workers. It serializes writes so
 * rapid form edits cannot reorder persisted snapshots, while keeping the
 * reducer itself synchronous and straightforward to test.
 */
export function createRegistrationStateStore(
  ownerId: string,
  storage: RegistrationStorage = AsyncStorage,
): RegistrationStateStore {
  let state = createEmptyRegistrationState(ownerId);
  let loaded = false;
  let loading: Promise<HighlineRegistrationState> | null = null;
  let writes: Promise<void> = Promise.resolve();
  const listeners = new Set<RegistrationStateListener>();

  const notify = () => {
    for (const listener of listeners) listener(state);
  };

  const load = async (): Promise<HighlineRegistrationState> => {
    if (loaded) return state;
    if (!loading) {
      const pending = loadRegistrationState(ownerId, storage).then(
        (next) => {
          state = next;
          loaded = true;
          loading = null;
          notify();
          return state;
        },
        (error: unknown) => {
          loading = null;
          throw error;
        },
      );
      loading = pending;
    }

    return loading;
  };

  const dispatch = async (
    action: RegistrationAction,
  ): Promise<HighlineRegistrationState> => {
    await load();
    const next = registrationReducer(state, action);
    if (next === state) return state;

    state = next;
    notify();

    const snapshot = state;
    const write = writes.then(() =>
      saveRegistrationState(ownerId, snapshot, storage),
    );
    // Keep the queue usable after one failed write; callers still receive the
    // original failure from this dispatch.
    writes = write.catch(() => undefined);
    await write;
    return state;
  };

  return {
    getState: () => state,
    isLoaded: () => loaded,
    load,
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Return the one in-memory store for a user. The storage identity guard keeps
 * tests and callers with an explicitly injected storage isolated, while the
 * production AsyncStorage instance is shared by every map/form/queue caller.
 */
export function getRegistrationStateStore(
  ownerId: string,
  storage: RegistrationStorage = AsyncStorage,
): RegistrationStateStore {
  if (!ownerId)
    throw new Error('An owner ID is required for registration state');

  const existing = registrationStores.get(ownerId);
  if (existing && existing.storage === storage) return existing.store;

  const store = createRegistrationStateStore(ownerId, storage);
  registrationStores.set(ownerId, { storage, store });
  return store;
}

export function clearRegistrationStateStore(ownerId: string): void {
  registrationStores.delete(ownerId);
}

export async function dispatchRegistrationAction(
  ownerId: string,
  action: RegistrationAction,
  storage: RegistrationStorage = AsyncStorage,
): Promise<HighlineRegistrationState> {
  return getRegistrationStateStore(ownerId, storage).dispatch(action);
}

export type UseRegistrationStateResult = {
  state: HighlineRegistrationState;
  store: RegistrationStateStore;
  isLoaded: boolean;
};

/**
 * React integration for screens that need registration state. Loading starts
 * once on mount through the repo's approved mount-only effect wrapper; all
 * updates thereafter arrive through `useSyncExternalStore` notifications.
 */
export function useRegistrationState(
  ownerId: string,
  storage: RegistrationStorage = AsyncStorage,
): UseRegistrationStateResult {
  const store = getRegistrationStateStore(ownerId, storage);
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(() => onStoreChange()),
    [store],
  );
  const state = useSyncExternalStore(subscribe, store.getState, store.getState);

  useMountEffect(() => {
    void store.load();
  });

  return { state, store, isLoaded: store.isLoaded() };
}
