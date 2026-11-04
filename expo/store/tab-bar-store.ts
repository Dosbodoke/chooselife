import { create } from 'zustand';

type State = {
  /** Set by overlays (a confirmation sheet, say) that tuck the bar away. */
  isHidden: boolean;
};

type Actions = {
  setHidden: (isHidden: boolean) => void;
};

export const useTabBarStore = create<State & Actions>((set) => ({
  isHidden: false,
  setHidden: (isHidden) => set({ isHidden }),
}));
