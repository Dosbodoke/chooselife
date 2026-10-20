import {
  formatCatalogModelName,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';

/** A SlackData model chosen in the picker; `null` means manual entry. */
export type WebbingModelSelection = {
  source: 'catalog';
  snapshot: WebbingCatalogSnapshot;
};

export function selectionName(selection: WebbingModelSelection) {
  return formatCatalogModelName(selection.snapshot);
}
