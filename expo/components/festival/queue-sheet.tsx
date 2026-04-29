import {
  formatFestivalQueueEstimateTime,
  getFestivalQueuePositionEstimate,
  useJoinFestivalQueue,
  useLeaveFestivalQueue,
  useRemoveFestivalQueueEntry,
  type FestivalHighlineQueueCard,
  type FestivalQueueEntry,
} from '@chooselife/ui';
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Trash2Icon } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';

import { useAuth } from '~/context/auth';

import { Button } from '~/components/ui/button';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';

const QueueEntryRow: React.FC<{
  canManage: boolean;
  entry: FestivalQueueEntry;
  isViewer: boolean;
  onRemove: (entryId: string) => void;
}> = ({ canManage, entry, isViewer, onRemove }) => {
  const { i18n, t } = useTranslation();
  const estimate = React.useMemo(
    () =>
      getFestivalQueuePositionEstimate({
        queuePosition: entry.queuePosition,
      }),
    [entry.queuePosition],
  );
  const estimateLabel =
    estimate.minutesUntilTurn === 0
      ? t('app.(festival).highlines.estimateNow')
      : t('app.(festival).highlines.estimateAt', {
          time: formatFestivalQueueEstimateTime({
            date: estimate.estimatedStartAt,
            locale: i18n.resolvedLanguage ?? i18n.language,
          }),
        });

  return (
    <View
      className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
        entry.status === 'called'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <View className="size-9 items-center justify-center rounded-full bg-slate-900">
        <Text className="text-sm font-bold text-white">
          {entry.queuePosition}
        </Text>
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold text-slate-900">
            {entry.display_name}
          </Text>
          {isViewer ? (
            <View className="rounded-full bg-slate-100 px-2 py-1">
              <Text className="text-[10px] font-semibold uppercase tracking-[0.8px] text-slate-500">
                {t('app.(festival).highlines.youLabel')}
              </Text>
            </View>
          ) : null}
        </View>
        {estimateLabel ? (
          <Text className="text-xs text-slate-400">{estimateLabel}</Text>
        ) : null}
      </View>

      {canManage ? (
        <Pressable
          accessibilityLabel={t('app.(festival).highlines.removeEntry')}
          className="rounded-full bg-rose-50 p-2"
          hitSlop={12}
          onPress={() => onRemove(entry.id)}
        >
          <Icon as={Trash2Icon} className="size-4 text-rose-500" />
        </Pressable>
      ) : null}
    </View>
  );
};

export const FestivalQueueSheet: React.FC<{
  card: FestivalHighlineQueueCard | null;
  canManage: boolean;
  festivalSlug: string;
  onDismiss: () => void;
  viewerDisplayName?: string | null;
}> = ({ card, canManage, festivalSlug, onDismiss, viewerDisplayName }) => {
  const { t } = useTranslation();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const selectedHighlineId = card?.highline.id ?? null;
  const { profile, session } = useAuth();
  const isAuthenticated = !!profile?.id;
  const queueDisplayName = React.useMemo(() => {
    const candidates = [
      viewerDisplayName,
      profile?.name,
      profile?.username,
      typeof session?.user.user_metadata?.full_name === 'string'
        ? session.user.user_metadata.full_name
        : null,
      typeof session?.user.user_metadata?.name === 'string'
        ? session.user.user_metadata.name
        : null,
      typeof session?.user.email === 'string'
        ? session.user.email.split('@')[0]
        : null,
    ];

    for (const candidate of candidates) {
      const normalized = candidate?.trim();
      if (normalized) {
        return normalized;
      }
    }

    return '';
  }, [
    profile?.name,
    profile?.username,
    session?.user.email,
    session?.user.user_metadata?.full_name,
    session?.user.user_metadata?.name,
    viewerDisplayName,
  ]);

  const joinMutation = useJoinFestivalQueue({ festivalSlug });
  const leaveMutation = useLeaveFestivalQueue({ festivalSlug });
  const removeMutation = useRemoveFestivalQueueEntry({ festivalSlug });

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  React.useEffect(() => {
    if (selectedHighlineId) {
      bottomSheetModalRef.current?.present();
      return;
    }

    bottomSheetModalRef.current?.dismiss();
  }, [selectedHighlineId]);

  const handleError = React.useCallback(
    (message?: string) => {
      Alert.alert(
        t('app.(festival).highlines.errorTitle'),
        message ?? t('app.(festival).highlines.genericError'),
      );
    },
    [t],
  );

  const handleJoin = React.useCallback(async () => {
    if (!card) return;
    if (!isAuthenticated) {
      handleError(t('app.(festival).highlines.authRequired'));
      return;
    }
    if (!queueDisplayName) {
      handleError(t('app.(festival).highlines.missingDisplayName'));
      return;
    }

    const result = await joinMutation.mutateAsync({
      festivalSlug,
      highlineId: card.highline.id,
      displayName: queueDisplayName,
    });

    if (!result.success) {
      handleError(result.error);
    }
  }, [
    card,
    festivalSlug,
    handleError,
    isAuthenticated,
    joinMutation,
    queueDisplayName,
    t,
  ]);

  const handleRemove = React.useCallback(
    async (entryId: string) => {
      const result = await removeMutation.mutateAsync({ entryId });

      if (!result.success) {
        handleError(result.error);
      }
    },
    [handleError, removeMutation],
  );

  const activeEntries = card?.queueSummary.activeEntries ?? [];
  const viewerEntry = card?.queueSummary.viewerEntry ?? null;

  const handleLeave = React.useCallback(async () => {
    if (!viewerEntry) return;

    const result = await leaveMutation.mutateAsync({
      entryId: viewerEntry.id,
    });

    if (!result.success) {
      handleError(result.error);
    }
  }, [handleError, leaveMutation, viewerEntry]);

  const renderFooter = React.useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View className="border-t border-slate-200 bg-white px-5 pb-6 pt-4">
          <Button
            className={`h-12 w-full rounded-2xl ${
              viewerEntry ? '' : 'bg-[#101b2b]'
            }`}
            disabled={joinMutation.isPending || leaveMutation.isPending}
            onPress={viewerEntry ? handleLeave : handleJoin}
            variant={viewerEntry ? 'destructive' : 'default'}
          >
            <Text className="font-semibold text-white">
              {viewerEntry
                ? t('app.(festival).highlines.leaveButton')
                : t('app.(festival).highlines.joinButton')}
            </Text>
          </Button>
        </View>
      </BottomSheetFooter>
    ),
    [
      handleJoin,
      handleLeave,
      joinMutation.isPending,
      leaveMutation.isPending,
      t,
      viewerEntry,
    ],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      snapPoints={['86%']}
      handleIndicatorStyle={{ backgroundColor: '#94a3b8' }}
      footerComponent={isAuthenticated ? renderFooter : undefined}
      onDismiss={onDismiss}
    >
      {card ? (
        <BottomSheetScrollView
          className="flex-1"
          contentContainerStyle={{
            gap: 24,
            paddingBottom: 120,
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <View className="gap-3">
            {!isAuthenticated ? (
              <View className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
                <Text className="text-sm leading-6 text-amber-950">
                  {t('app.(festival).highlines.authRequired')}
                </Text>
              </View>
            ) : null}

            <Text className="text-lg font-bold text-slate-900">
              {t('app.(festival).highlines.fullQueueTitle')}
            </Text>

            {activeEntries.length === 0 ? (
              <View className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                <Text className="text-center text-sm text-slate-500">
                  {t('app.(festival).highlines.queueEmpty')}
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {activeEntries.map((entry) => (
                  <QueueEntryRow
                    key={entry.id}
                    canManage={canManage}
                    entry={entry}
                    isViewer={entry.id === viewerEntry?.id}
                    onRemove={handleRemove}
                  />
                ))}
              </View>
            )}
          </View>
        </BottomSheetScrollView>
      ) : null}
    </BottomSheetModal>
  );
};
