import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { cn } from '~/lib/utils';

import { Text } from '../ui/text';
import { type Category } from './index';

interface Props {
  selectedCategory: Category;
  visibleCategories: Category[];
}

/** Horizontally scrolling category chips; the selection lives in `?category=`. */
export const CategoryChips = ({
  selectedCategory,
  visibleCategories,
}: Props) => {
  const { t } = useTranslation();
  const router = useRouter();
  const labels = useMemo<Record<Category, string>>(
    () => ({
      speedline: 'Speedline',
      cadenas: t('components.ranking.category-dropdown.sent'),
      distance: t('components.ranking.category-dropdown.distance'),
      fullLine: 'Full Lines',
    }),
    [t],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="gap-2 px-4"
    >
      {visibleCategories.map((category) => {
        const selected = category === selectedCategory;
        return (
          <Pressable
            key={category}
            role="tab"
            aria-selected={selected}
            onPress={() => {
              if (selected) return;
              Haptics.selectionAsync();
              router.setParams({ category });
            }}
            className={cn(
              'px-4 py-2 rounded-full border',
              selected
                ? 'bg-foreground border-foreground'
                : 'bg-white border-gray-200',
            )}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                selected ? 'text-background' : 'text-foreground',
              )}
            >
              {labels[category]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
