import type { ResolvedWebbingSpecs } from '@chooselife/ui';
import {
  groupInventory,
  layoutInventory,
  rowStrengthClaims,
  toInventoryEntries,
  totalLength,
  WEBBING_GROUPINGS,
} from '~/features/webbing/inventory';
import { Link } from 'expo-router';
import { PackageIcon, SearchIcon, XIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { useAuth } from '~/context/auth';
import { useSavedWebbingCatalogPhotos } from '~/hooks/use-webbing-catalog-assets';
import { useWebbingGrouping } from '~/hooks/use-webbing-grouping';
import { useUserWebbings, type WebbingWithUsage } from '~/hooks/use-webbings';
import { getR2PublicUrl } from '~/lib/r2';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { PrimaryButton } from '~/components/ui/primary-button';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { CatalogAttribution } from '~/components/webbing-catalog-specs';

import { InventoryGroupingMenu } from './inventory-grouping-menu';
import { WebbingInventoryHeading } from './webbing-inventory-heading';
import { WebbingInventoryRow } from './webbing-inventory-row';

const translationKey = 'components.settings.my-webbing';

export function MyWebbings() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: webbings, isPending, isError, refetch } = useUserWebbings();

  if (!profile) {
    return (
      <View className="gap-4 p-4">
        <Text>{t(`${translationKey}.loginRequired`)}</Text>
        <Link asChild href="/(modals)/login">
          <PrimaryButton label={t('app.(tabs).settings.logIn')} />
        </Link>
      </View>
    );
  }
  if (isPending) {
    return (
      <View className="gap-3">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-11 rounded-xl" />
        {[0, 1, 2].map((id) => (
          <Skeleton key={id} className="h-16 rounded-2xl" />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View className="gap-4 rounded-2xl bg-white p-6">
        <Text>{t(`${translationKey}.loadError`)}</Text>
        <Button variant="outline" onPress={() => void refetch()}>
          <Text>{t(`${translationKey}.retry`)}</Text>
        </Button>
      </View>
    );
  }
  if (!webbings.length) {
    return (
      <View className="items-center gap-3 rounded-2xl bg-white px-6 py-10">
        <Icon as={PackageIcon} size={32} className="text-muted-foreground" />
        <Text className="text-center text-base font-semibold">
          {t(`${translationKey}.empty`)}
        </Text>
        <Text className="text-center text-sm text-muted-foreground">
          {t(`${translationKey}.emptyDescription`)}
        </Text>
      </View>
    );
  }
  // A different viewer starts with a fresh search, collapse and photo state.
  return <WebbingInventory key={profile.id} webbings={webbings} />;
}

function WebbingInventory({ webbings }: { webbings: WebbingWithUsage[] }) {
  const { t, i18n } = useTranslation();
  const grouping = useWebbingGrouping((state) => state.grouping);
  const setGrouping = useWebbingGrouping((state) => state.setGrouping);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const catalogPhotos = useSavedWebbingCatalogPhotos(webbings);

  const entries = toInventoryEntries(webbings);
  const sections = layoutInventory(
    groupInventory(entries, grouping, i18n.language),
    { query, collapsed },
  );
  const searching = !!query.trim();
  const matchCount = sections.reduce((n, s) => n + s.matches.length, 0);
  const grouped = grouping !== 'none';
  const anyExpanded = sections.some((section) => section.expanded);

  const modelPhoto = (specs: ResolvedWebbingSpecs) =>
    (specs.catalog && catalogPhotos.get(specs.catalog.sourceId)) ||
    (specs.legacyImagePath
      ? getR2PublicUrl('webbings', specs.legacyImagePath)
      : undefined);

  const updateCollapsed = (keys: string[], collapse: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (collapse) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
        <Text className="text-base font-semibold text-slate-900">
          {t(`${translationKey}.count`, { count: entries.length })}
        </Text>
        <Text className="text-xs text-slate-500">
          {t(`${translationKey}.totalLength`, {
            length: totalLength(entries).toLocaleString(i18n.language),
          })}
        </Text>
      </View>

      {/* At large text sizes the menu wraps below the search field. */}
      <View className="flex-row flex-wrap items-center gap-2">
        <InventorySearch value={query} onChangeText={setQuery} />
        <InventoryGroupingMenu
          value={grouping}
          options={WEBBING_GROUPINGS.map((value) => ({
            value,
            label: t(`${translationKey}.grouping.${value}`),
          }))}
          onChange={setGrouping}
          title={t(`${translationKey}.groupBy`)}
        />
      </View>

      <View className="min-h-6 flex-row items-center justify-between gap-3 px-1">
        <Text className="flex-1 text-xs text-slate-500">
          {searching
            ? t(`${translationKey}.searchResults`, {
                shown: matchCount,
                count: entries.length,
              })
            : grouped
              ? t(`${translationKey}.groupCount`, { count: sections.length })
              : t(`${translationKey}.orderedById`)}
        </Text>
        {grouped && !searching && sections.length > 1 ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            onPress={() =>
              updateCollapsed(
                sections.map((section) => section.group.key),
                anyExpanded,
              )
            }
          >
            <Text className="text-xs font-semibold text-blue-600">
              {t(
                `${translationKey}.${anyExpanded ? 'collapseAll' : 'expandAll'}`,
              )}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!matchCount ? (
        <View className="items-center gap-3 rounded-2xl bg-white px-6 py-8">
          <Text className="text-center text-sm text-slate-500">
            {t(`${translationKey}.noResults`, { query: query.trim() })}
          </Text>
          <Button variant="outline" onPress={() => setQuery('')}>
            <Text>{t(`${translationKey}.clearSearch`)}</Text>
          </Button>
        </View>
      ) : null}

      {/* One flat, keyed list across every grouping: a row never remounts
          when it changes group, so an in-flight photo save keeps its state.
          Collapsed and filtered rows hide instead of unmounting; that is
          never more than the fully expanded list this screen starts with. */}
      <View>
        {sections.flatMap((section) => {
          const { group, matches, expanded } = section;
          const visible = expanded ? matches : [];
          const idDigits = Math.max(
            2,
            ...matches.map(({ webbing }) => String(webbing.id).length),
          );
          const headingPhoto =
            group.subject.kind === 'model'
              ? modelPhoto(group.subject.specs)
              : undefined;
          return [
            grouped && matches.length ? (
              <WebbingInventoryHeading
                key={`heading:${group.key}`}
                section={section}
                searching={searching}
                photoUri={headingPhoto}
                onToggle={() => updateCollapsed([group.key], expanded)}
              />
            ) : null,
            ...group.entries.map((entry) => (
              <WebbingInventoryRow
                key={`webbing:${entry.webbing.id}`}
                entry={entry}
                subject={group.subject}
                idDigits={idDigits}
                claims={rowStrengthClaims(entry, group.subject)}
                hasModelPhoto={!!modelPhoto(entry.specs)}
                hidden={!visible.includes(entry)}
                first={visible[0] === entry}
                last={visible[visible.length - 1] === entry}
              />
            )),
          ];
        })}
      </View>

      {catalogPhotos.size > 0 && matchCount > 0 ? (
        <CatalogAttribution showPhotoCredit className="mt-2 px-1" />
      ) : null}
    </View>
  );
}

function InventorySearch({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="min-h-11 grow basis-52 flex-row items-center rounded-xl border border-slate-200 bg-white pl-3">
      <Icon as={SearchIcon} size={16} className="text-slate-400" />
      <TextInput
        accessibilityLabel={t(`${translationKey}.search`)}
        placeholder={t(`${translationKey}.search`)}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        className="min-w-0 flex-1 py-2.5 pl-2 text-[15px] text-slate-900"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${translationKey}.clearSearch`)}
          onPress={() => onChangeText('')}
          className="size-11 items-center justify-center"
        >
          <View className="size-5 items-center justify-center rounded-full bg-slate-200">
            <Icon as={XIcon} size={12} className="text-slate-600" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
