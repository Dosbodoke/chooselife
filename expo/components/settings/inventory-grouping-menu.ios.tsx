import {
  Host,
  HStack,
  Image,
  Menu,
  Picker,
  Section,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  frame,
  menuIndicator,
  menuStyle,
  padding,
  pickerStyle,
  shapes,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import type { InventoryGroupingMenuProps } from './inventory-grouping-menu.types';

/** Native SwiftUI menu with a checkmarked list, styled as a search-bar sibling. */
export function InventoryGroupingMenu({
  value,
  options,
  onChange,
  title,
}: InventoryGroupingMenuProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <View className="min-h-11 justify-center rounded-xl border border-slate-200 bg-white">
      {/* Scrolled under the navigation bar, the hosting view would otherwise
          push its label down by the top inset. */}
      <Host matchContents ignoreSafeArea="container">
        <Menu
          modifiers={[
            menuStyle('button'),
            buttonStyle('plain'),
            menuIndicator('hidden'),
            accessibilityLabel(`${title}: ${selected?.label ?? ''}`),
          ]}
          label={
            <HStack
              spacing={6}
              modifiers={[
                padding({ horizontal: 12 }),
                frame({ minHeight: 44 }),
                contentShape(shapes.rectangle()),
              ]}
            >
              <Image
                systemName="square.stack.3d.up"
                modifiers={[
                  font({ textStyle: 'footnote' }),
                  foregroundStyle('#64748b'),
                ]}
              />
              <Text
                modifiers={[
                  font({ textStyle: 'subheadline', weight: 'medium' }),
                  foregroundStyle('#0f172a'),
                ]}
              >
                {selected?.label ?? ''}
              </Text>
              <Image
                systemName="chevron.up.chevron.down"
                modifiers={[
                  font({ textStyle: 'caption2', weight: 'semibold' }),
                  foregroundStyle('#94a3b8'),
                ]}
              />
            </HStack>
          }
        >
          <Section title={title}>
            <Picker
              selection={value}
              onSelectionChange={(selection) => {
                const option = options.find((o) => o.value === selection);
                if (option) onChange(option.value);
              }}
              modifiers={[pickerStyle('inline')]}
            >
              {options.map((option) => (
                <Text key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </Text>
              ))}
            </Picker>
          </Section>
        </Menu>
      </Host>
    </View>
  );
}
