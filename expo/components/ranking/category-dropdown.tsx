import { useRouter } from 'expo-router';
import { ArrowDownIcon } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Icon } from '~/components/ui/icon';

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
  const { t } = useTranslation();
  const router = useRouter();
  const categories = useMemo<Record<Category, { label: string }>>(
    () => ({
      speedline: { label: 'Speedline' },
      cadenas: { label: t('components.ranking.category-dropdown.sent') },
      distance: { label: t('components.ranking.category-dropdown.distance') },
      fullLine: { label: 'Full Lines' },
    }),
    [],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity className="group flex-row items-center gap-1">
          <Animated.View>
            <Icon
              as={ArrowDownIcon}
              className="size-4 text-gray-900 dark:text-white"
            />
          </Animated.View>

          <Text className="capitalize text-xl font-bold leading-none">
            {categories[selectedCategory].label}
          </Text>
        </TouchableOpacity>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>
          {t('components.ranking.category-dropdown.menuLabel')}
        </DropdownMenuLabel>
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
