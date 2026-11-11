import { isWebbingGrouping } from '~/features/webbing/inventory';
import { ChevronsUpDownIcon, Layers3Icon } from 'lucide-react-native';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import type { InventoryGroupingMenuProps } from './inventory-grouping-menu.types';

/**
 * Android and web. The universal `@expo/ui` Picker renders a full-width
 * Material text field on Android, which does not fit beside the search bar.
 */
export function InventoryGroupingMenu({
  value,
  options,
  onChange,
  title,
}: InventoryGroupingMenuProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        accessibilityLabel={`${title}: ${selected?.label ?? ''}`}
        className="min-h-11 flex-row items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 active:bg-slate-50"
      >
        <Icon as={Layers3Icon} size={14} className="text-slate-500" />
        <Text className="text-sm font-medium text-slate-900">
          {selected?.label}
        </Text>
        <Icon as={ChevronsUpDownIcon} size={12} className="text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (isWebbingGrouping(next)) onChange(next);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <Text>{option.label}</Text>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
