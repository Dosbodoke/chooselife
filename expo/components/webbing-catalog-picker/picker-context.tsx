import type { WebbingCatalogSnapshot } from '@chooselife/ui';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  captureGrowthEvent,
  flushGrowthEvents,
} from '~/features/growth/analytics';
import {
  WebbingPickerSession,
  type WebbingPickerExperiment,
  type WebbingPickerLayout,
} from '~/features/growth/webbing-picker-layout';
import {
  applyCatalogFilters,
  availableCatalogFilters,
  catalogFilterId,
  DEFAULT_CATALOG_SORT,
  nextCatalogSort,
  sortCatalogItems,
  type CatalogFilter,
  type CatalogSort,
  type CatalogSortKey,
} from '~/features/webbing/catalog-browse';
import { filterWebbingCatalog } from '~/features/webbing/catalog-client';
import {
  createContext,
  use,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { useOnlineStatus } from '~/context/react-query';
import {
  useWebbingCatalog,
  type WebbingCatalog,
} from '~/hooks/use-webbing-catalog';

import {
  useLegacyWebbingModels,
  type LegacyWebbingModel,
  type WebbingModelSelection,
} from './model-selection';

type PickerContextValue = {
  state: {
    value: WebbingModelSelection | null;
    search: string;
    sort: CatalogSort;
    filterOptions: CatalogFilter[];
    activeFilterIds: Set<string>;
    hasFilters: boolean;
    /** Catalog models after search, filters and sort. */
    items: WebbingCatalogSnapshot[];
    legacyItems: LegacyWebbingModel[];
    /** Locked for each presentation of the sheet. */
    layout: WebbingPickerLayout;
    isSortMenuOpen: boolean;
  };
  actions: {
    open: () => void;
    close: () => void;
    handleDismiss: () => void;
    search: (text: string) => void;
    chooseSort: (key: CatalogSortKey) => void;
    toggleSortMenu: () => void;
    closeSortMenu: () => void;
    toggleFilter: (filter: CatalogFilter) => void;
    clearFilters: () => void;
    /** Catalog cards became visible in this presentation. */
    markExposed: () => void;
    /** `position` is 1-based within the list the user saw. */
    selectCatalog: (snapshot: WebbingCatalogSnapshot, position: number) => void;
    selectLegacy: (model: LegacyWebbingModel) => void;
    chooseManual: () => void;
  };
  meta: {
    sheetRef: RefObject<BottomSheetModal | null>;
    catalog: WebbingCatalog;
    legacy: UseQueryResult<LegacyWebbingModel[]>;
    isOnline: boolean;
  };
};

const PickerContext = createContext<PickerContextValue | null>(null);

export function usePicker() {
  const context = use(PickerContext);
  if (!context) {
    throw new Error('usePicker must be used within a PickerProvider');
  }
  return context;
}

/**
 * Re-provides the picker to content rendered through a portal, such as a
 * bottom sheet, which mounts outside this tree and loses its context.
 */
export function PickerContextBridge({
  value,
  children,
}: {
  value: PickerContextValue;
  children: ReactNode;
}) {
  return <PickerContext value={value}>{children}</PickerContext>;
}

/**
 * The only place that knows how the picker's state is held. Search, sort and
 * filters survive closing the sheet; each presentation gets its own analytics
 * session and a locked layout.
 */
export function PickerProvider({
  value,
  onChange,
  experiment,
  children,
}: {
  value: WebbingModelSelection | null;
  onChange: (selection: WebbingModelSelection | null) => void;
  experiment: WebbingPickerExperiment;
  children: ReactNode;
}) {
  const isOnline = useOnlineStatus();
  const catalog = useWebbingCatalog();
  const legacy = useLegacyWebbingModels();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<CatalogSort>(DEFAULT_CATALOG_SORT);
  const [filters, setFilters] = useState<CatalogFilter[]>([]);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [layout, setLayout] = useState(experiment.layout);
  const sheetRef = useRef<BottomSheetModal>(null);
  // Read and written only in event handlers, never during render.
  const session = useRef<WebbingPickerSession | null>(null);

  const allItems = catalog.data?.items ?? [];
  const items = sortCatalogItems(
    applyCatalogFilters(filterWebbingCatalog(allItems, search), filters),
    sort,
  );
  const query = search.trim().toLowerCase();
  const legacyItems = (legacy.data ?? []).filter(
    (model) => !query || model.name.toLowerCase().includes(query),
  );
  const activeFilterIds = new Set(filters.map(catalogFilterId));

  const close = () => sheetRef.current?.close();

  const open = () => {
    session.current?.close();
    session.current = new WebbingPickerSession(experiment, captureGrowthEvent);
    setLayout(experiment.layout);
    setIsSortMenuOpen(false);
    sheetRef.current?.present();
    catalog.loadOnOpen();
  };

  const handleDismiss = () => {
    session.current?.close('dismissed');
    session.current = null;
    setIsSortMenuOpen(false);
    flushGrowthEvents();
  };

  const select = (selection: WebbingModelSelection | null) => {
    onChange(selection);
    close();
  };

  const chooseSort = (key: CatalogSortKey) => {
    const next = nextCatalogSort(sort, key);
    setSort(next);
    setIsSortMenuOpen(false);
    session.current?.sort(next.key, next.desc);
  };

  const toggleFilter = (filter: CatalogFilter) => {
    const id = catalogFilterId(filter);
    const enabled = !activeFilterIds.has(id);
    const next = enabled
      ? [...filters, filter]
      : filters.filter((f) => catalogFilterId(f) !== id);
    setFilters(next);
    session.current?.filter(id, enabled, next.length);
  };

  const contextValue: PickerContextValue = {
    state: {
      value,
      search,
      sort,
      filterOptions: availableCatalogFilters(allItems),
      activeFilterIds,
      hasFilters: filters.length > 0,
      items,
      legacyItems,
      layout,
      isSortMenuOpen,
    },
    actions: {
      open,
      close,
      handleDismiss,
      search: (text) => {
        setSearch(text);
        session.current?.search(text);
      },
      chooseSort,
      toggleSortMenu: () => setIsSortMenuOpen((isOpen) => !isOpen),
      closeSortMenu: () => setIsSortMenuOpen(false),
      toggleFilter,
      clearFilters: () => setFilters([]),
      markExposed: () => session.current?.expose(items.length),
      selectCatalog: (snapshot, position) => {
        session.current?.select('catalog', position, sort);
        select({ source: 'catalog', snapshot });
      },
      selectLegacy: (model) => {
        session.current?.select('legacy', 0, sort);
        select({ source: 'legacy', model });
      },
      chooseManual: () => {
        session.current?.chooseManual();
        select(null);
      },
    },
    meta: { sheetRef, catalog, legacy, isOnline },
  };

  return <PickerContext value={contextValue}>{children}</PickerContext>;
}
