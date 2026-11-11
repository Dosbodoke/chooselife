import {
  isWebbingGrouping,
  type WebbingGrouping,
} from '~/features/webbing/inventory';
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';

const PREFERENCE_KEY = 'webbing-inventory-grouping-v1';
function readGrouping(): WebbingGrouping {
  try {
    const value = AsyncStorage.getItemSync(PREFERENCE_KEY);
    return isWebbingGrouping(value) ? value : 'model';
  } catch {
    return 'model';
  }
}

/** Device preference only. Never stores inventory, account, search or collapse state. */
export const useWebbingGrouping = create<{
  grouping: WebbingGrouping;
  setGrouping: (grouping: WebbingGrouping) => void;
}>((set) => ({
  grouping: readGrouping(),
  setGrouping: (grouping) => {
    set({ grouping });
    try {
      AsyncStorage.setItemSync(PREFERENCE_KEY, grouping);
    } catch {
      // Storage may be unavailable; the selection still works for this session.
    }
  },
}));
