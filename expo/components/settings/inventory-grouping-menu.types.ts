import type { WebbingGrouping } from '~/features/webbing/inventory';

export type InventoryGroupingMenuProps = {
  value: WebbingGrouping;
  options: { value: WebbingGrouping; label: string }[];
  onChange: (value: WebbingGrouping) => void;
  /** "Group by": the menu's title and the start of its accessible label. */
  title: string;
};
