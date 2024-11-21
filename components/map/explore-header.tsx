import { useRef, useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LucideIcon } from '~/lib/icons/lucide-icon';

const ExploreHeader: React.FC<{ onSearchChange: (text: string) => void }> = ({
  onSearchChange,
}) => {
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    onSearchChange(text);
  };

  const handleFocusSearchInput = () => {
    searchInputRef.current?.focus();
  };

  return (
    <SafeAreaView>
      <View className="bg-background pt-2 shadow">
        <View className="flex-row items-center justify-between px-6 pb-4 gap-3">
          <TouchableOpacity
            className="flex-1 flex-row bg-background gap-3 p-4 items-center border-hairline border-muted rounded-3xl shadow-md"
            onPress={handleFocusSearchInput}
          >
            <LucideIcon name="Search" className="size-6 text-primary" />
            <TextInput
              ref={searchInputRef}
              placeholder="Nome do Highline"
              value={search}
              onChangeText={handleSearchChange}
              className="flex-1"
            />
          </TouchableOpacity>
          {/* <TouchableOpacity className="p-4 items-center justify-center h-12">
            <LucideIcon name="Filter" className="size-6 text-primary" />
          </TouchableOpacity> */}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ExploreHeader;
