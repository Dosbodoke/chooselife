import {
  BottomSheetVirtualizedList,
  BottomSheetVirtualizedListMethods,
} from '@gorhom/bottom-sheet';
import React from 'react';

import type { Highline } from '~/hooks/use-highline';

import { HighlineCard } from '~/components/highline/highline-card';

const Listings: React.FC<{
  highlines: Highline[];
  refresh: number;
}> = ({ highlines, refresh }) => {
  const listRef = React.useRef<BottomSheetVirtualizedListMethods>(null);

  // Update the view to scroll the list back top
  React.useEffect(() => {
    if (refresh) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [refresh]);

  const renderItem = React.useCallback(
    ({ item }: { item: Highline }) => <HighlineCard item={item} />,
    [],
  );

  return (
    <BottomSheetVirtualizedList<Highline>
      ref={listRef}
      data={highlines}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      getItemCount={(data) => data.length}
      getItem={(data, index) => data[index]}
    />
  );
};

export default Listings;
