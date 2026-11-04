import { View } from 'react-native';

import { CatalogAttribution } from '~/components/webbing-catalog-specs';

import { usePicker } from './picker-context';

export function CatalogFooter() {
  const {
    state: { photoUris },
    meta: { catalog },
  } = usePicker();

  if (!catalog.data) return null;

  return (
    <View className="pt-6 pb-20">
      <CatalogAttribution showPhotoCredit={photoUris.size > 0} />
    </View>
  );
}
