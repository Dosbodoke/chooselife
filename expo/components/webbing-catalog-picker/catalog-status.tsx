import {
  CatalogError,
  isCatalogStale,
} from '~/features/webbing/catalog-client';
import { AlertTriangleIcon, CloudOffIcon, InfoIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { useMountEffect } from '~/hooks/use-mount-effect';

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
} from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';

import { usePicker } from './picker-context';

const translationKey = 'app.(modals).register-webbing.selectModel';

/** List header: manual entry, catalog load state and empty results. */
export function ResultsHeader() {
  const { t } = useTranslation();
  const {
    actions,
    meta: { catalog },
  } = usePicker();

  return (
    <View className="gap-3 pb-3">
      <Button variant="secondary" onPress={actions.chooseManual}>
        <Text>{t(`${translationKey}.manual`)}</Text>
      </Button>
      {/* A new cooldown starts a fresh clock. */}
      <CatalogStatus key={catalog.retryAt ?? 'no-cooldown'} />
      <IncompleteNotice />
      <EmptyResults />
    </View>
  );
}

/**
 * Whether a retry cooldown is still running at `now`; re-renders once it
 * ends. Mount the caller per `retryAt` so each cooldown starts fresh.
 */
function useRetryCooldown(retryAt: number | null, now: number) {
  const [isOver, setIsOver] = useState(false);
  const isWaiting = !isOver && retryAt !== null && retryAt > now;

  useMountEffect(() => {
    if (!isWaiting || retryAt === null) return;
    const timer = setTimeout(() => setIsOver(true), retryAt - Date.now() + 50);
    return () => clearTimeout(timer);
  });

  return {
    isWaiting,
    seconds:
      isWaiting && retryAt !== null
        ? Math.max(1, Math.ceil((retryAt - now) / 1000))
        : 0,
  };
}

type Cooldown = ReturnType<typeof useRetryCooldown>;

function CatalogStatus() {
  const {
    meta: { catalog },
  } = usePicker();
  // Read once per mount, which is once per presentation and per cooldown.
  const [now] = useState(() => Date.now());
  const cooldown = useRetryCooldown(catalog.retryAt, now);
  const isCancelled =
    catalog.error instanceof CatalogError && catalog.error.kind === 'cancelled';
  const failed = catalog.isError && !isCancelled;

  if (!catalog.data) {
    return <FirstLoadStatus failed={failed} cooldown={cooldown} />;
  }
  if (failed) {
    return <LoadedCatalogAlert reason="refreshFailed" cooldown={cooldown} />;
  }
  if (isCatalogStale(catalog.dataUpdatedAt, now)) {
    return <LoadedCatalogAlert reason="stale" cooldown={cooldown} />;
  }
  return null;
}

/** Nothing loaded yet: loading, offline, or unavailable. */
function FirstLoadStatus({
  failed,
  cooldown,
}: {
  failed: boolean;
  cooldown: Cooldown;
}) {
  const { t } = useTranslation();
  const {
    meta: { catalog, isOnline },
  } = usePicker();

  if (catalog.isFetching) {
    return (
      <View className="flex-row items-center gap-2 py-2">
        <ActivityIndicator />
        <Text className="text-sm text-muted-foreground">
          {t(`${translationKey}.loading`)}
        </Text>
      </View>
    );
  }
  if (!isOnline || catalog.fetchStatus === 'paused') {
    return (
      <Alert variant="default">
        <AlertIcon icon={CloudOffIcon} />
        <AlertContent>
          <AlertDescription>{t(`${translationKey}.offline`)}</AlertDescription>
        </AlertContent>
      </Alert>
    );
  }
  if (!failed) return null;
  return (
    <Alert variant="warning">
      <AlertIcon icon={AlertTriangleIcon} />
      <AlertContent className="gap-2">
        <AlertDescription>
          {t(`${translationKey}.unavailable`)}
        </AlertDescription>
        <RetryButton cooldown={cooldown} label={t(`${translationKey}.retry`)} />
        {cooldown.isWaiting && (
          <Text className="text-xs text-muted-foreground">
            {t(`${translationKey}.retryHint`)}
          </Text>
        )}
      </AlertContent>
    </Alert>
  );
}

/** A loaded catalog that could not refresh, or is getting old. */
function LoadedCatalogAlert({
  reason,
  cooldown,
}: {
  reason: 'refreshFailed' | 'stale';
  cooldown: Cooldown;
}) {
  const { t, i18n } = useTranslation();
  const {
    meta: { catalog },
  } = usePicker();
  const loadedAt = new Date(catalog.dataUpdatedAt).toLocaleString(
    i18n.language,
    { dateStyle: 'short', timeStyle: 'short' },
  );

  return (
    <Alert variant={reason === 'refreshFailed' ? 'warning' : 'default'}>
      <AlertIcon
        icon={reason === 'refreshFailed' ? AlertTriangleIcon : InfoIcon}
      />
      <AlertContent className="gap-2">
        <AlertDescription>
          {t(`${translationKey}.${reason}`, { time: loadedAt })}
        </AlertDescription>
        <RetryButton
          cooldown={cooldown}
          label={t(`${translationKey}.refresh`)}
        />
      </AlertContent>
    </Alert>
  );
}

function RetryButton({
  cooldown,
  label,
}: {
  cooldown: Cooldown;
  label: string;
}) {
  const { t } = useTranslation();
  const {
    meta: { catalog, isOnline },
  } = usePicker();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={cooldown.isWaiting || catalog.isFetching || !isOnline}
      onPress={catalog.retry}
      className="self-start"
    >
      <Text>
        {cooldown.isWaiting
          ? t(`${translationKey}.retryIn`, { seconds: cooldown.seconds })
          : label}
      </Text>
    </Button>
  );
}

function IncompleteNotice() {
  const { t } = useTranslation();
  const {
    meta: { catalog },
  } = usePicker();
  const data = catalog.data;
  if (!data || (data.invalidRecordCount === 0 && data.degradedFieldCount === 0))
    return null;

  return (
    <Alert variant="info">
      <AlertIcon icon={InfoIcon} />
      <AlertContent>
        <AlertDescription>{t(`${translationKey}.incomplete`)}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}

function EmptyResults() {
  const { t } = useTranslation();
  const {
    state: { items, search, hasFilters },
    actions,
    meta: { catalog },
  } = usePicker();
  if (!catalog.data || items.length > 0) return null;

  const query = search.trim();
  const message =
    catalog.data.items.length === 0
      ? t(`${translationKey}.emptyCatalog`)
      : query
        ? t(`${translationKey}.noMatches`, { query })
        : t(`${translationKey}.noFilterMatches`);

  return (
    <View className="items-center gap-2 py-4">
      <Text className="text-center text-muted-foreground">{message}</Text>
      {hasFilters && (
        <Button variant="ghost" size="sm" onPress={actions.clearFilters}>
          <Text>{t(`${translationKey}.clearFilters`)}</Text>
        </Button>
      )}
    </View>
  );
}
