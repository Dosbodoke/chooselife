import * as Haptics from 'expo-haptics';
import { icons } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type HighlineCategory } from '~/hooks/use-highline-list';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { Text } from '~/components/ui/text';

const categories: Array<{
  category: HighlineCategory;
  name: string;
  icon: keyof typeof icons;
}> = [
  {
    category: 'favorites',
    name: 'favoritos',
    icon: 'Heart',
  },
  {
    category: 'big line',
    name: 'Big Line',
    icon: 'Ruler',
  },
  {
    category: 'rigged',
    name: 'Montada',
    icon: 'Activity',
  },
  {
    category: 'unrigged',
    name: 'Desmontada',
    icon: 'PowerOff',
  },
  {
    category: 'planned',
    name: 'Planejada',
    icon: 'CalendarClock',
  },
];

const ExploreHeader: React.FC<{
  onSearchChange: (text: string) => void;
  onCategoryChange: (category: HighlineCategory | null) => void;
}> = ({ onSearchChange, onCategoryChange }) => {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const itemsRef = useRef<Array<View | null>>([]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    onSearchChange(text);
  };

  const handleFocusSearchInput = () => {
    searchInputRef.current?.focus();
  };

  const selectCategory = (index: number) => {
    // Unselect
    if (activeIndex === index) {
      setActiveIndex(0);
      onCategoryChange(null);
    }
    const selected = itemsRef.current[index];
    setActiveIndex(index);
    selected?.measure((x) => {
      scrollRef.current?.scrollTo({ x: x - 16, y: 0, animated: true });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCategoryChange(categories[index].category);
  };

  return (
    <SafeAreaView>
      <View className="bg-background pt-2 pb-4 shadow gap-6 px-6">
        <View className="flex-row items-center justify-between gap-3">
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
        </View>

        <ScrollView
          horizontal
          ref={scrollRef}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="items-center gap-8 px-4"
        >
          {categories.map((item, index) => (
            <TouchableOpacity
              ref={(el) => (itemsRef.current[index] = el)}
              key={index}
              className={cn(
                'items-center justify-center',
                activeIndex === index && 'border-b-2 border-primary',
              )}
              onPress={() => selectCategory(index)}
            >
              <LucideIcon
                name={item.icon}
                className={cn(
                  'size-6',
                  activeIndex === index
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              />
              <Text
                className={cn(
                  activeIndex === index
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default ExploreHeader;
