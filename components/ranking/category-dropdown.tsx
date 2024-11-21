import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';

import { LucideIcon } from '~/lib/icons/lucide-icon';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

import { Text } from '../ui/text';
import { type Category } from './index';

interface Props {
  selectedCategory: Category;
  visibleCategories: Category[];
}

export const CategoryDropdown = ({
  selectedCategory,
  visibleCategories,
}: Props) => {
  const router = useRouter();
  const categories = useMemo<Record<Category, { label: string }>>(
    () => ({
      speedline: { label: 'Speedline' },
      cadenas: { label: 'Cadenas' },
      distance: { label: 'Distância' },
      fullLine: { label: 'Full Lines' },
    }),
    [],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity className="group flex-row items-center gap-1">
          <Animated.View>
            <LucideIcon
              name="ArrowDown"
              className="size-4 text-gray-900 dark:text-white"
            />
          </Animated.View>

          <Text className="capitalize text-xl font-bold leading-none">
            {categories[selectedCategory].label}
          </Text>
        </TouchableOpacity>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Trocar modalidade</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedCategory}
          onValueChange={(category) => router.setParams({ category })}
        >
          {visibleCategories.map((category) => (
            <DropdownMenuRadioItem key={category} value={category}>
              <Text>{categories[category].label}</Text>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
