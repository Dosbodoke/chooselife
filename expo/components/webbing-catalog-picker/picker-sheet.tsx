import {
  formatCatalogModelName,
  SLACKDATA_SITE_URL,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  useBottomSheet,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  CATALOG_SORT_OPTIONS,
  catalogFilterId,
  type CatalogFilter,
} from '~/features/webbing/catalog-browse';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ExternalLinkIcon,
  SearchIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type ListViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { openExternal } from '~/lib/open-external';
import { cn } from '~/lib/utils';

import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

import { SpecTilesCard, WideCard } from './catalog-cards';
import { CatalogFooter } from './catalog-footer';
import { ResultsHeader } from './catalog-status';
import {
  GRID_COLUMNS,
  GRID_GAP,
  GRID_PADDING,
  useGridItemWidth,
  useRowItemWidth,
} from './grid';
import { PickerContextBridge, usePicker } from './picker-context';

const translationKey = 'app.(modals).register-webbing.selectModel';
const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

export function PickerSheet() {
  const picker = usePicker();
  const {
    actions,
    meta: { sheetRef },
  } = picker;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['85%']}
      enablePanDownToClose
      backdropComponent={SheetBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      enableDynamicSizing={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      activeOffsetY={[-10, 10]}
      // Horizontal swipes fail the sheet's pan so the filter chips can scroll.
      failOffsetX={[-5, 5]}
      backgroundStyle={styles.background}
      onDismiss={actions.handleDismiss}
    >
      {/* The sheet renders in a portal host, outside the picker's context. */}
      <PickerContextBridge value={picker}>
        <SheetHeader />
        <View className="flex-1">
          <ResultsList />
          <SortMenu />
        </View>
      </PickerContextBridge>
    </BottomSheetModal>
  );
}

/** Dims the screen and swallows pans so they never reach the parent modal. */
function SheetBackdrop({ animatedIndex }: BottomSheetBackdropProps) {
  const { close } = useBottomSheet();
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [-1, 0], [0, 0.5]),
  }));
  const gesture = Gesture.Race(
    Gesture.Pan(),
    Gesture.Tap().onEnd(() => {
      scheduleOnRN(close);
    }),
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, animatedStyle]}
      />
    </GestureDetector>
  );
}

function SheetHeader() {
  const { t } = useTranslation();
  const {
    meta: { catalog },
  } = usePicker();

  return (
    <View className="gap-2.5 pb-3 mx-4 mb-3 border-b border-border">
      <Text className="text-xl font-bold text-center text-foreground">
        {t(`${translationKey}.label`)}
      </Text>
      <SearchField />
      {catalog.data ? (
        <>
          <View className="flex-row items-center gap-2">
            <SortButton />
            <FilterChips />
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <ResultCount total={catalog.data.items.length} />
            <SourceLink />
          </View>
        </>
      ) : null}
    </View>
  );
}

function SearchField() {
  const { t } = useTranslation();
  const {
    state: { search },
    actions,
  } = usePicker();

  return (
    <View className="flex-row items-center rounded-lg border border-input bg-background px-3">
      <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
      <BottomSheetTextInput
        value={search}
        onChangeText={actions.search}
        placeholder={t(`${translationKey}.searchPlaceholder`)}
        accessibilityLabel={t(`${translationKey}.searchPlaceholder`)}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        className="flex-1 p-3 text-foreground"
      />
    </View>
  );
}

function SortButton() {
  const { t } = useTranslation();
  const {
    state: { sort, isSortMenuOpen },
    actions,
  } = usePicker();
  const foreground = isSortMenuOpen ? 'text-background' : 'text-foreground';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: isSortMenuOpen }}
      accessibilityLabel={t(`${translationKey}.sort.a11y`, {
        option: t(`${translationKey}.sort.${sort.key}`),
      })}
      onPress={actions.toggleSortMenu}
      className={cn(
        'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
        isSortMenuOpen ? 'bg-foreground' : 'bg-muted',
      )}
    >
      <Icon as={ArrowUpDownIcon} size={14} className={foreground} />
      <Text className={cn('text-xs font-bold', foreground)}>
        {t(`${translationKey}.sort.short.${sort.key}`)}
      </Text>
      {sort.key !== 'brand' && (
        <Icon
          as={sort.desc ? ArrowDownIcon : ArrowUpIcon}
          size={12}
          className={foreground}
        />
      )}
    </Pressable>
  );
}

function FilterChips() {
  const {
    state: { filterOptions },
  } = usePicker();

  return (
    <FlatList
      horizontal
      data={filterOptions}
      keyExtractor={catalogFilterId}
      renderItem={({ item }) => <FilterChip filter={item} />}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 pr-4"
      className="flex-1"
    />
  );
}

function FilterChip({ filter }: { filter: CatalogFilter }) {
  const { t } = useTranslation();
  const {
    state: { activeFilterIds },
    actions,
  } = usePicker();
  const isOn = activeFilterIds.has(catalogFilterId(filter));
  const label =
    filter.kind === 'material'
      ? filter.material
      : t(
          `${translationKey}.filters.${filter.kind === 'isa-certified' ? 'isaCertified' : 'inProduction'}`,
        );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
      onPress={() => actions.toggleFilter(filter)}
      className={cn(
        'rounded-full border px-3 py-1.5',
        isOn ? 'border-foreground bg-foreground' : 'border-border',
      )}
    >
      <Text
        className={cn('text-xs', isOn ? 'text-background' : 'text-foreground')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ResultCount({ total }: { total: number }) {
  const { t } = useTranslation();
  const {
    state: { items },
  } = usePicker();

  return (
    <Text className="text-xs text-muted-foreground">
      {items.length === total
        ? t(`${translationKey}.count`, { count: total })
        : t(`${translationKey}.countFiltered`, { shown: items.length, total })}
    </Text>
  );
}

/** Visible source credit; the full license is in the list footer. */
function SourceLink() {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={t(`${translationKey}.sourceA11y`)}
      onPress={() => openExternal(SLACKDATA_SITE_URL)}
      hitSlop={8}
      className="flex-row items-center gap-1"
    >
      <Text className="text-xs text-muted-foreground">
        {t(`${translationKey}.source`)}
      </Text>
      <Text className="text-xs font-medium text-blue-700">
        {t('app.(modals).register-webbing.catalog.site')}
      </Text>
      <Icon as={ExternalLinkIcon} size={12} className="text-blue-700" />
    </TouchableOpacity>
  );
}

function ResultsList() {
  const {
    state: { items, layout },
    actions,
  } = usePicker();
  const isGrid = layout === 'tiles';

  // Exposure means catalog cards actually became visible in this sheet.
  const handleViewableItemsChanged = ({
    viewableItems,
  }: {
    viewableItems: ListViewToken[];
  }) => {
    if (viewableItems.length > 0) actions.markExposed();
  };

  return (
    <BottomSheetFlatList
      // Column count can't change on a mounted list.
      key={layout}
      data={items}
      numColumns={isGrid ? GRID_COLUMNS : 1}
      keyExtractor={(item: WebbingCatalogSnapshot) =>
        `${item.source}-${item.sourceId}`
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      columnWrapperStyle={isGrid ? { gap: GRID_GAP } : undefined}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<ResultsHeader />}
      ListFooterComponent={<CatalogFooter />}
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={handleViewableItemsChanged}
      renderItem={({
        item,
        index,
      }: {
        item: WebbingCatalogSnapshot;
        index: number;
      }) => <CatalogResult model={item} position={index + 1} />}
    />
  );
}

function CatalogResult({
  model,
  position,
}: {
  model: WebbingCatalogSnapshot;
  position: number;
}) {
  const { t } = useTranslation();
  const gridWidth = useGridItemWidth();
  const rowWidth = useRowItemWidth();
  const {
    state: { value, sort, layout, photoUris },
    actions,
  } = usePicker();
  const isSelected =
    value?.source === 'catalog' &&
    value.snapshot.source === model.source &&
    value.snapshot.sourceId === model.sourceId;
  const Card = layout === 'tiles' ? SpecTilesCard : WideCard;

  return (
    <Card
      model={model}
      imageUri={photoUris.get(model.sourceId) ?? null}
      selected={isSelected}
      sortKey={sort.key}
      width={layout === 'tiles' ? gridWidth : rowWidth}
      accessibilityLabel={t(`${translationKey}.selectModelFor`, {
        name: formatCatalogModelName(model),
      })}
      onPress={() => actions.selectCatalog(model, position)}
    />
  );
}

function SortMenu() {
  const { t } = useTranslation();
  const {
    state: { sort, isSortMenuOpen },
    actions,
  } = usePicker();
  if (!isSortMenuOpen) return null;

  return (
    <>
      <Pressable
        className="absolute inset-0 bg-black/5"
        onPress={actions.closeSortMenu}
        accessibilityLabel={t(`${translationKey}.sort.close`)}
      />
      <View
        accessibilityRole="menu"
        className="absolute left-4 top-0 w-64 rounded-2xl bg-background py-1.5"
        style={styles.menuShadow}
      >
        <Text className="px-3.5 py-1.5 text-xs text-muted-foreground">
          {t(`${translationKey}.sort.title`)}
        </Text>
        {CATALOG_SORT_OPTIONS.map((option) => {
          const isActive = option.key === sort.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: isActive }}
              onPress={() => actions.chooseSort(option.key)}
              className={cn(
                'min-h-11 flex-row items-center gap-2 px-3.5 py-2.5',
                isActive && 'bg-muted',
              )}
            >
              <View className="flex-1">
                <Text
                  className={cn(
                    'text-sm text-foreground',
                    isActive && 'font-semibold',
                  )}
                >
                  {t(`${translationKey}.sort.${option.key}`)}
                </Text>
                {isActive && option.key !== 'brand' && (
                  <Text className="text-[11px] text-muted-foreground">
                    {t(
                      `${translationKey}.sort.${sort.desc ? 'highToLow' : 'lowToHigh'}`,
                    )}
                  </Text>
                )}
              </View>
              {isActive && (
                <Icon as={CheckIcon} size={16} className="text-foreground" />
              )}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'black' },
  background: { backgroundColor: '#ffffff' },
  handleIndicator: { backgroundColor: '#ccc', width: 40 },
  listContent: { paddingHorizontal: GRID_PADDING, gap: GRID_GAP },
  menuShadow: { boxShadow: '0 8px 18px rgba(0, 0, 0, 0.16)' },
});
