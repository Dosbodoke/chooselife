import {
  formatCatalogModelName,
  isSafeExternalUrl,
  SLACKDATA_LICENSE_URL,
  SLACKDATA_SITE_URL,
  type WebbingCatalogSnapshot,
} from '@chooselife/ui';
import {
  BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useQuery } from '@tanstack/react-query';
import {
  captureGrowthEvent,
  flushGrowthEvents,
} from '~/features/growth/analytics';
import {
  WebbingPickerSession,
  type WebbingPickerExperiment,
} from '~/features/growth/webbing-picker-layout';
import {
  applyCatalogFilters,
  availableCatalogFilters,
  CATALOG_SORT_OPTIONS,
  catalogFilterId,
  DEFAULT_CATALOG_SORT,
  nextCatalogSort,
  sortCatalogItems,
  type CatalogFilter,
  type CatalogSort,
} from '~/features/webbing/catalog-browse';
import {
  CatalogError,
  filterWebbingCatalog,
} from '~/features/webbing/catalog-client';
import { Image } from 'expo-image';
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CloudOffIcon,
  ExternalLinkIcon,
  InfoIcon,
  SearchIcon,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useOnlineStatus } from '~/context/react-query';
import { useWebbingCatalog } from '~/hooks/use-webbing-catalog';
import { getR2PublicUrl } from '~/lib/r2';
import { supabase } from '~/lib/supabase';
import { cn } from '~/lib/utils';
import { Tables } from '~/utils/database.types';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
} from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Label } from '~/components/ui/label';
import { Text } from '~/components/ui/text';
import { SpecTilesCard, WideCard } from '~/components/webbing-catalog-cards';

export type LegacyWebbingModel = Tables<'webbing_model'>;

const translationKey = 'app.(modals).register-webbing';

// Grid layout constants - 2 columns
const screenWidth = Dimensions.get('window').width;
const numColumns = 2;
const horizontalPadding = 32; // px-4 on each side
const gap = 12;
const itemWidth =
  (screenWidth - horizontalPadding - (numColumns - 1) * gap) / numColumns;

/** Local Choose Life models, kept separate from the public SlackData catalog. */
function useLegacyWebbingModels() {
  return useQuery({
    queryKey: ['webbing-models', 'legacy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webbing_model')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

function openExternal(url: string | null | undefined) {
  if (isSafeExternalUrl(url)) void Linking.openURL(url);
}

export const CatalogAttribution: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { t } = useTranslation();
  return (
    <View className={cn('gap-1', className)}>
      <Text className="text-xs text-muted-foreground">
        {t(`${translationKey}.catalog.attribution`)}.{' '}
        {t(`${translationKey}.catalog.normalized`)}
      </Text>
      <View className="flex-row gap-4">
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => openExternal(SLACKDATA_SITE_URL)}
          className="min-h-8 justify-center"
        >
          <Text className="text-xs font-medium text-blue-700 underline">
            {t(`${translationKey}.catalog.site`)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => openExternal(SLACKDATA_LICENSE_URL)}
          className="min-h-8 justify-center"
        >
          <Text className="text-xs font-medium text-blue-700 underline">
            {t(`${translationKey}.catalog.license`)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const LegacyModelImage: React.FC<{
  model: LegacyWebbingModel;
  size: 'sm' | 'lg';
}> = ({ model, size }) => {
  if (!model.image_url) {
    return null;
  }
  return (
    <View
      className={cn(
        'relative overflow-hidden border border-border bg-muted',
        size === 'sm' ? 'h-10 w-10 rounded-lg' : 'h-20 w-20 rounded-xl',
      )}
    >
      <Image
        source={{ uri: getR2PublicUrl('webbings', model.image_url) }}
        contentFit="cover"
        alt={model.name}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
};

function formatLoadedAt(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export interface WebbingCatalogPickerProps {
  labelId: string;
  selectedSnapshot: WebbingCatalogSnapshot | null;
  selectedLegacy: LegacyWebbingModel | null;
  onSelectCatalog: (snapshot: WebbingCatalogSnapshot) => void;
  onSelectLegacy: (model: LegacyWebbingModel) => void;
  onClear: () => void;
  /** Layout experiment cohort; locked for each presentation of the sheet. */
  experiment: WebbingPickerExperiment;
}

const VIEWABILITY = { itemVisiblePercentThreshold: 50 };

export const WebbingCatalogPicker: React.FC<WebbingCatalogPickerProps> = ({
  labelId,
  selectedSnapshot,
  selectedLegacy,
  onSelectCatalog,
  onSelectLegacy,
  onClear,
  experiment,
}) => {
  const { t, i18n } = useTranslation();
  const isOnline = useOnlineStatus();
  const catalog = useWebbingCatalog();
  const legacy = useLegacyWebbingModels();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<CatalogSort>(DEFAULT_CATALOG_SORT);
  const [filters, setFilters] = useState<CatalogFilter[]>([]);
  const [sortOpen, setSortOpen] = useState(false);
  // The cohort shown in the open sheet never changes mid-presentation.
  const [activeExperiment, setActiveExperiment] = useState(experiment);
  const session = useRef<WebbingPickerSession | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const allItems = catalog.data?.items;
  const filterOptions = useMemo(
    () => availableCatalogFilters(allItems ?? []),
    [allItems],
  );
  const items = useMemo(
    () =>
      sortCatalogItems(
        applyCatalogFilters(
          filterWebbingCatalog(allItems ?? [], search),
          filters,
        ),
        sort,
      ),
    [allItems, search, filters, sort],
  );
  const itemCount = useRef(0);
  itemCount.current = items.length;
  // Exposure means catalog cards actually became visible in this sheet.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) session.current?.expose(itemCount.current);
    },
  ).current;
  const layout = activeExperiment.layout;
  const legacyItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (legacy.data ?? []).filter(
      (model) => !query || model.name.toLowerCase().includes(query),
    );
  }, [legacy.data, search]);

  const open = () => {
    session.current?.close();
    session.current = new WebbingPickerSession(experiment, captureGrowthEvent);
    setActiveExperiment(experiment);
    setSortOpen(false);
    sheetRef.current?.present();
    catalog.loadOnOpen();
  };
  const close = () => sheetRef.current?.close();
  const onDismiss = () => {
    session.current?.close('dismissed');
    session.current = null;
    setSortOpen(false);
    flushGrowthEvents();
  };
  const chooseSort = (key: CatalogSort['key']) => {
    const next = nextCatalogSort(sort, key);
    setSort(next);
    setSortOpen(false);
    session.current?.sort(next.key, next.desc);
  };
  const toggleFilter = (filter: CatalogFilter) => {
    const id = catalogFilterId(filter);
    const enabled = !filters.some((f) => catalogFilterId(f) === id);
    const next = enabled
      ? [...filters, filter]
      : filters.filter((f) => catalogFilterId(f) !== id);
    setFilters(next);
    session.current?.filter(id, enabled, next.length);
  };
  const filterLabel = (filter: CatalogFilter) =>
    filter.kind === 'material'
      ? filter.material
      : t(
          `${translationKey}.selectModel.filters.${filter.kind === 'isa-certified' ? 'isaCertified' : 'inProduction'}`,
        );

  // Custom backdrop that blocks all touch gestures from propagating to parent modal
  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => {
    const CustomBackdrop = () => {
      const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(props.animatedIndex.value, [-1, 0], [0, 0.5]),
      }));
      // Pan gesture that captures swipes but does nothing - prevents propagation
      const panGesture = Gesture.Pan();
      const closeModal = () => sheetRef.current?.close();
      const tapGesture = Gesture.Tap().onEnd(() => {
        scheduleOnRN(closeModal);
      });
      return (
        <GestureDetector gesture={Gesture.Race(panGesture, tapGesture)}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'black' },
              animatedStyle,
            ]}
          />
        </GestureDetector>
      );
    };
    return <CustomBackdrop />;
  }, []);

  const hasData = !!catalog.data;
  const isCancelled =
    catalog.error instanceof CatalogError && catalog.error.kind === 'cancelled';
  const showError = catalog.isError && !isCancelled;
  const isOfflineBeforeLoad =
    !hasData && (!isOnline || catalog.fetchStatus === 'paused');
  const retrySeconds = catalog.retryAt
    ? Math.max(1, Math.ceil((catalog.retryAt - Date.now()) / 1000))
    : 0;
  const incomplete =
    !!catalog.data &&
    (catalog.data.invalidRecordCount > 0 ||
      catalog.data.degradedFieldCount > 0);

  const retryButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={!catalog.canRetry || catalog.isFetching || !isOnline}
      onPress={catalog.retry}
      className="self-start"
    >
      <Text>
        {catalog.canRetry
          ? t(`${translationKey}.selectModel.${hasData ? 'refresh' : 'retry'}`)
          : t(`${translationKey}.selectModel.retryIn`, {
              seconds: retrySeconds,
            })}
      </Text>
    </Button>
  );

  const header = (
    <View className="gap-3 pb-3">
      <Button
        variant="secondary"
        onPress={() => {
          session.current?.chooseManual();
          onClear();
          close();
        }}
      >
        <Text>{t(`${translationKey}.selectModel.manual`)}</Text>
      </Button>

      {catalog.isFetching && !hasData ? (
        <View className="flex-row items-center gap-2 py-2">
          <ActivityIndicator />
          <Text className="text-sm text-muted-foreground">
            {t(`${translationKey}.selectModel.loading`)}
          </Text>
        </View>
      ) : isOfflineBeforeLoad ? (
        <Alert variant="default">
          <AlertIcon icon={CloudOffIcon} />
          <AlertContent>
            <AlertDescription>
              {t(`${translationKey}.selectModel.offline`)}
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : showError && !hasData ? (
        <Alert variant="warning">
          <AlertIcon icon={AlertTriangleIcon} />
          <AlertContent className="gap-2">
            <AlertDescription>
              {t(`${translationKey}.selectModel.unavailable`)}
            </AlertDescription>
            {retryButton}
            {!catalog.canRetry && (
              <Text className="text-xs text-muted-foreground">
                {t(`${translationKey}.selectModel.retryHint`)}
              </Text>
            )}
          </AlertContent>
        </Alert>
      ) : hasData && (showError || catalog.isStale) ? (
        <Alert variant={showError ? 'warning' : 'default'}>
          <AlertIcon icon={showError ? AlertTriangleIcon : InfoIcon} />
          <AlertContent className="gap-2">
            <AlertDescription>
              {t(
                `${translationKey}.selectModel.${showError ? 'refreshFailed' : 'stale'}`,
                { time: formatLoadedAt(catalog.dataUpdatedAt, i18n.language) },
              )}
            </AlertDescription>
            {retryButton}
          </AlertContent>
        </Alert>
      ) : null}

      {incomplete && (
        <Alert variant="info">
          <AlertIcon icon={InfoIcon} />
          <AlertContent>
            <AlertDescription>
              {t(`${translationKey}.selectModel.incomplete`)}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {hasData && items.length === 0 && (
        <View className="items-center gap-2 py-4">
          <Text className="text-center text-muted-foreground">
            {catalog.data!.items.length === 0
              ? t(`${translationKey}.selectModel.emptyCatalog`)
              : search.trim()
                ? t(`${translationKey}.selectModel.noMatches`, {
                    query: search.trim(),
                  })
                : t(`${translationKey}.selectModel.noFilterMatches`)}
          </Text>
          {filters.length > 0 && (
            <Button variant="ghost" size="sm" onPress={() => setFilters([])}>
              <Text>{t(`${translationKey}.selectModel.clearFilters`)}</Text>
            </Button>
          )}
        </View>
      )}
    </View>
  );

  const footer = (
    <View className="gap-3 pt-6 pb-20">
      {hasData && <CatalogAttribution />}
      <Text className="text-base font-semibold text-foreground">
        {t(`${translationKey}.selectModel.legacyTitle`)}
      </Text>
      {legacy.isError ? (
        <Text className="text-sm text-muted-foreground">
          {t(`${translationKey}.selectModel.legacyUnavailable`)}
        </Text>
      ) : legacy.isPending ? (
        <ActivityIndicator />
      ) : (
        <View className="flex-row flex-wrap" style={{ gap }}>
          {legacyItems.map((model) => {
            const isSelected = selectedLegacy?.id === model.id;
            return (
              <TouchableOpacity
                key={`legacy-${model.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={t(
                  `${translationKey}.selectModel.selectModelFor`,
                  {
                    name: model.name,
                  },
                )}
                onPress={() => {
                  session.current?.select('legacy', 0, sort);
                  onSelectLegacy(model);
                  close();
                }}
                style={{ width: itemWidth }}
                className={cn(
                  'items-start justify-center gap-1 p-4 rounded-2xl border',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/30',
                )}
              >
                {model.image_url && (
                  <View className="mb-2">
                    <LegacyModelImage model={model} size="lg" />
                  </View>
                )}
                <Text className="text-sm font-semibold text-foreground">
                  {model.name}
                </Text>
                <Text className="text-xs capitalize text-muted-foreground">
                  {model.material} · {model.weave}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const selectedLabel = selectedSnapshot
    ? formatCatalogModelName(selectedSnapshot)
    : selectedLegacy?.name;

  return (
    <View className="gap-2 w-full">
      <Label nativeID={labelId}>
        {t(`${translationKey}.selectModel.label`)}
      </Label>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabelledBy={labelId}
        onPress={open}
        className="flex-row justify-between items-center px-4 py-3 rounded-md border border-input bg-background"
      >
        {selectedLabel ? (
          <View className="flex-1 flex-row items-center gap-3">
            {selectedLegacy?.image_url ? (
              <LegacyModelImage model={selectedLegacy} size="sm" />
            ) : null}
            <Text className="flex-1 text-primary" numberOfLines={2}>
              {selectedLabel}
            </Text>
          </View>
        ) : (
          <Text className="flex-1 text-muted-foreground">
            {t(`${translationKey}.selectModel.placeholder`)}
          </Text>
        )}
        <Icon as={ChevronDownIcon} className="text-foreground" />
      </TouchableOpacity>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['85%']}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: '#ccc', width: 40 }}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        activeOffsetY={[-10, 10]}
        failOffsetX={[-5, 5]}
        backgroundStyle={{ backgroundColor: '#ffffff' }}
        onDismiss={onDismiss}
      >
        <View className="gap-2.5 pb-3 mx-4 mb-3 border-b border-border">
          <Text className="text-xl font-bold text-center text-foreground">
            {t(`${translationKey}.selectModel.label`)}
          </Text>
          <View className="flex-row items-center rounded-lg border border-input bg-background px-3">
            <Icon as={SearchIcon} size={18} className="text-muted-foreground" />
            <BottomSheetTextInput
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                session.current?.search(text);
              }}
              placeholder={t(`${translationKey}.selectModel.searchPlaceholder`)}
              accessibilityLabel={t(
                `${translationKey}.selectModel.searchPlaceholder`,
              )}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="flex-1 p-3 text-foreground"
            />
          </View>
          {hasData && (
            <>
              <View className="flex-row items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: sortOpen }}
                  accessibilityLabel={t(
                    `${translationKey}.selectModel.sort.a11y`,
                    {
                      option: t(
                        `${translationKey}.selectModel.sort.${sort.key}`,
                      ),
                    },
                  )}
                  onPress={() => setSortOpen((value) => !value)}
                  className={cn(
                    'flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
                    sortOpen ? 'bg-foreground' : 'bg-muted',
                  )}
                >
                  <Icon
                    as={ArrowUpDownIcon}
                    size={14}
                    className={sortOpen ? 'text-background' : 'text-foreground'}
                  />
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      sortOpen ? 'text-background' : 'text-foreground',
                    )}
                  >
                    {t(`${translationKey}.selectModel.sort.short.${sort.key}`)}
                  </Text>
                  {sort.key !== 'brand' && (
                    <Icon
                      as={sort.desc ? ArrowDownIcon : ArrowUpIcon}
                      size={12}
                      className={
                        sortOpen ? 'text-background' : 'text-foreground'
                      }
                    />
                  )}
                </Pressable>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerClassName="gap-2 pr-4"
                  className="flex-1"
                >
                  {filterOptions.map((filter) => {
                    const id = catalogFilterId(filter);
                    const on = filters.some((f) => catalogFilterId(f) === id);
                    return (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        onPress={() => toggleFilter(filter)}
                        className={cn(
                          'rounded-full border px-3 py-1.5',
                          on
                            ? 'border-foreground bg-foreground'
                            : 'border-border',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-xs',
                            on ? 'text-background' : 'text-foreground',
                          )}
                        >
                          {filterLabel(filter)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-xs text-muted-foreground">
                  {items.length === allItems!.length
                    ? t(`${translationKey}.selectModel.count`, {
                        count: items.length,
                      })
                    : t(`${translationKey}.selectModel.countFiltered`, {
                        shown: items.length,
                        total: allItems!.length,
                      })}
                </Text>
                {/* Visible source credit; the full license is in the footer. */}
                <TouchableOpacity
                  accessibilityRole="link"
                  accessibilityLabel={t(
                    `${translationKey}.selectModel.sourceA11y`,
                  )}
                  onPress={() => openExternal(SLACKDATA_SITE_URL)}
                  hitSlop={8}
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-xs text-muted-foreground">
                    {t(`${translationKey}.selectModel.source`)}
                  </Text>
                  <Text className="text-xs font-medium text-blue-700">
                    {t(`${translationKey}.catalog.site`)}
                  </Text>
                  <Icon
                    as={ExternalLinkIcon}
                    size={12}
                    className="text-blue-700"
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
        <View className="flex-1">
          <BottomSheetFlatList
            key={layout}
            data={items}
            numColumns={layout === 'tiles' ? numColumns : 1}
            keyExtractor={(item: WebbingCatalogSnapshot) =>
              `${item.source}-${item.sourceId}`
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            columnWrapperStyle={layout === 'tiles' ? { gap } : undefined}
            contentContainerStyle={{ paddingHorizontal: 16, gap }}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            viewabilityConfig={VIEWABILITY}
            onViewableItemsChanged={onViewableItemsChanged}
            renderItem={({
              item,
              index,
            }: {
              item: WebbingCatalogSnapshot;
              index: number;
            }) => {
              const isSelected =
                selectedSnapshot?.sourceId === item.sourceId &&
                selectedSnapshot.source === item.source;
              const Card = layout === 'tiles' ? SpecTilesCard : WideCard;
              return (
                <Card
                  model={item}
                  // SlackData supplies no images; Choose Life has none yet.
                  imageUri={null}
                  selected={isSelected}
                  sortKey={sort.key}
                  width={layout === 'tiles' ? itemWidth : screenWidth - 32}
                  accessibilityLabel={t(
                    `${translationKey}.selectModel.selectModelFor`,
                    { name: formatCatalogModelName(item) },
                  )}
                  onPress={() => {
                    session.current?.select('catalog', index + 1, sort);
                    onSelectCatalog(item);
                    close();
                  }}
                />
              );
            }}
          />

          {sortOpen && (
            <>
              <Pressable
                className="absolute inset-0 bg-black/5"
                onPress={() => setSortOpen(false)}
                accessibilityLabel={t(
                  `${translationKey}.selectModel.sort.close`,
                )}
              />
              <View
                accessibilityRole="menu"
                className="absolute left-4 top-0 w-64 rounded-2xl bg-background py-1.5"
                style={styles.menuShadow}
              >
                <Text className="px-3.5 py-1.5 text-xs text-muted-foreground">
                  {t(`${translationKey}.selectModel.sort.title`)}
                </Text>
                {CATALOG_SORT_OPTIONS.map((option) => {
                  const active = option.key === sort.key;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: active }}
                      onPress={() => chooseSort(option.key)}
                      className={cn(
                        'min-h-11 flex-row items-center gap-2 px-3.5 py-2.5',
                        active && 'bg-muted',
                      )}
                    >
                      <View className="flex-1">
                        <Text
                          className={cn(
                            'text-sm text-foreground',
                            active && 'font-semibold',
                          )}
                        >
                          {t(
                            `${translationKey}.selectModel.sort.${option.key}`,
                          )}
                        </Text>
                        {active && option.key !== 'brand' && (
                          <Text className="text-[11px] text-muted-foreground">
                            {t(
                              `${translationKey}.selectModel.sort.${sort.desc ? 'highToLow' : 'lowToHigh'}`,
                            )}
                          </Text>
                        )}
                      </View>
                      {active && (
                        <Icon
                          as={CheckIcon}
                          size={16}
                          className="text-foreground"
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  menuShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

export const SelectedCatalogDetails: React.FC<{
  snapshot: WebbingCatalogSnapshot;
}> = ({ snapshot }) => {
  return (
    <View className="gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <CatalogSpecs snapshot={snapshot} />
      <CatalogAttribution />
    </View>
  );
};

/** Normalized SlackData fields; unknown values are labelled, never guessed. */
export const CatalogSpecs: React.FC<{ snapshot: WebbingCatalogSnapshot }> = ({
  snapshot,
}) => {
  const { t } = useTranslation();
  const key = 'components.webbing-detail.specifications';
  const unknown = t(`${key}.notRecorded`);
  const yesNo = (value: boolean | null) =>
    value === null ? unknown : t(`${key}.${value ? 'yes' : 'no'}`);
  const measure = (
    value: number | null,
    unit: 'mm' | 'gramsPerMeter' | 'kn',
  ) => (value === null ? unknown : t(`${key}.${unit}`, { value }));

  const rows: [string, string][] = [
    [t(`${key}.materials`), snapshot.materials?.join(' / ') ?? unknown],
    [t(`${key}.construction`), snapshot.construction ?? unknown],
    [t(`${key}.width`), measure(snapshot.widthMm, 'mm')],
    [t(`${key}.thickness`), measure(snapshot.thicknessMm, 'mm')],
    [
      t(`${key}.weight`),
      measure(snapshot.weightGramsPerMeter, 'gramsPerMeter'),
    ],
    [t(`${key}.breakingStrength`), measure(snapshot.breakingStrengthKn, 'kn')],
    [
      t(`${key}.stretch`),
      snapshot.stretch?.length
        ? snapshot.stretch
            .map((point) => t(`${key}.stretchAt`, point))
            .join(', ')
        : unknown,
    ],
    [t(`${key}.isaCertified`), yesNo(snapshot.isaCertified)],
    [t(`${key}.isaClass`), snapshot.isaClass ?? unknown],
    [
      t(`${key}.status`),
      snapshot.active === null
        ? unknown
        : t(`${key}.${snapshot.active ? 'active' : 'discontinued'}`),
    ],
  ];
  if (snapshot.isaCertificate) {
    rows.push([t(`${key}.isaCertificate`), snapshot.isaCertificate]);
  }

  return (
    <View className="gap-3">
      {snapshot.manufacturerNotForHighline === true && (
        <Alert variant="destructive">
          <AlertIcon icon={AlertTriangleIcon} />
          <AlertContent>
            <AlertDescription>
              {t('components.webbing-detail.warnings.notForHighline')}
              {snapshot.manufacturerNotForHighlineSource
                ? `\n${t(
                    'components.webbing-detail.warnings.notForHighlineSource',
                    {
                      source: snapshot.manufacturerNotForHighlineSource,
                    },
                  )}`
                : ''}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      {snapshot.isaWarning && (
        <Alert variant="warning">
          <AlertIcon icon={AlertTriangleIcon} />
          <AlertContent>
            <AlertDescription>
              {t('components.webbing-detail.warnings.isaWarning')}:{' '}
              {snapshot.isaWarning}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
      <View className="gap-1.5">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between gap-3">
            <Text className="text-xs text-muted-foreground">{label}</Text>
            <Text className="flex-1 text-xs font-medium text-right text-foreground">
              {value}
            </Text>
          </View>
        ))}
      </View>
      {isSafeExternalUrl(snapshot.productUrl) && (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => openExternal(snapshot.productUrl)}
          className="flex-row items-center gap-1.5 min-h-8"
        >
          <Icon as={ExternalLinkIcon} size={14} className="text-blue-700" />
          <Text className="text-xs font-medium text-blue-700">
            {t(`${key}.productPage`)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
