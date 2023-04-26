import { useState, useMemo } from 'react';
import { View, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { trpc } from '@src/utils/trpc';
import { SearchScreenProps } from '@src/navigation/types';

import Header from './components/Header';
import HighlineItem from './components/HighlineItem';
import EmptySearch from './components/EmptySearch';
import EmptyList from './components/EmptyList';

const SearchScreen = ({ navigation }: SearchScreenProps) => {
  const [nameFilter, setNameFilter] = useState('');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetching, isFetchingNextPage } =
    trpc.highline.getList.useInfiniteQuery(
      { limit: 20, nameFilter },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!nameFilter,
      }
    );

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.items?.filter((item) => item !== undefined) ?? []);
  }, [data]);

  function loadNext() {
    if (hasNextPage) fetchNextPage();
  }

  const emptyComponent = () => {
    if (!nameFilter) {
      return <EmptySearch />;
    }
    if (isLoading) {
      return (
        <View className="flex h-48 flex-col items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      );
    }
    return <EmptyList />;
  };

  const footerComponent = () => (
    <View className="mt-5">{isFetchingNextPage ? <ActivityIndicator size="small" /> : null}</View>
  );

  return (
    <View className="flex h-full bg-white">
      <SafeAreaView />
      <Header onSearch={(filter) => setNameFilter(filter)} goBack={() => navigation.goBack()} />
      <View className="mx-2 flex-1">
        <FlashList
          data={filteredData}
          keyExtractor={(item) => item.uuid}
          onEndReached={loadNext}
          onEndReachedThreshold={0.2}
          estimatedItemSize={117}
          refreshing={isFetching}
          ListEmptyComponent={emptyComponent}
          ListFooterComponent={footerComponent}
          renderItem={({ item }) => (
            <HighlineItem
              highline={item}
              onPress={() => navigation.push('Details', { highline: item })}
            />
          )}
        />
      </View>
    </View>
  );
};

export default SearchScreen;
