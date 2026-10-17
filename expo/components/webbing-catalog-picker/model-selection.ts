import {
  formatCatalogModelName,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '~/lib/supabase';
import { Tables } from '~/utils/database.types';

export type LegacyWebbingModel = Tables<'webbing_model'>;

/** A model chosen in the picker; `null` means manual entry. */
export type WebbingModelSelection =
  | { source: 'catalog'; snapshot: WebbingCatalogSnapshot }
  | { source: 'legacy'; model: LegacyWebbingModel };

export function selectionName(selection: WebbingModelSelection) {
  return selection.source === 'catalog'
    ? formatCatalogModelName(selection.snapshot)
    : selection.model.name;
}

/** Local Choose Life models, kept separate from the public SlackData catalog. */
export function useLegacyWebbingModels() {
  return useQuery({
    queryKey: ['webbing-models', 'legacy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webbing_model')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}
