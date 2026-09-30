import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AnchorPosition,
  HighlineRegistrationState,
  RegistrationStage,
} from '~/features/highline-registration/state/model';
import type { RegistrationAction } from '~/features/highline-registration/state/reducer';
import { selectPendingMapLines } from '~/features/highline-registration/state/selectors';
import { useRegistrationState } from '~/features/highline-registration/state/store';
import { useMapStore, type LocationPickerRequest } from '~/store/map-store';
import { useRouter } from 'expo-router';
import {
  CheckIcon,
  ChevronLeftIcon,
  EyeIcon,
  EyeOffIcon,
  MapPinIcon,
  PencilIcon,
  RotateCcwIcon,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import { useOnlineStatus } from '~/context/react-query';
import { highlineKeyFactory } from '~/hooks/use-highline';
import { useMountEffect } from '~/hooks/use-mount-effect';
import { supabase } from '~/lib/supabase';

import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import { haversineDistance, positionToPostGISPoint } from './utils';

type PickerStage = Exclude<RegistrationStage, 'adjust'>;

type PickerChromeProps = {
  stage: PickerStage;
  adjustingAnchor: 'a' | 'b' | null;
  anchorA: AnchorPosition | null;
  anchorB: AnchorPosition | null;
  center: AnchorPosition;
  existingHighlinesVisible: boolean;
  isSaving: boolean;
  isOffline: boolean;
  editing: boolean;
  onBack: () => void;
  onUndo: () => void;
  onPick: () => void;
  onAdjust: (anchor: 'a' | 'b') => void;
  onContinue: () => void;
  onToggleExistingHighlines: () => void;
};

const PickerCenter: React.FC<{
  stage: PickerStage;
  adjustingAnchor: 'a' | 'b' | null;
  anchorA: AnchorPosition | null;
  anchorB: AnchorPosition | null;
  center: AnchorPosition;
}> = ({ stage, adjustingAnchor, anchorA, anchorB, center }) => {
  const { t } = useTranslation();

  if (stage === 'review') return null;

  const referenceAnchor =
    adjustingAnchor === 'a'
      ? anchorB
      : adjustingAnchor === 'b'
        ? anchorA
        : anchorA;
  const distance = referenceAnchor
    ? haversineDistance(
        referenceAnchor[1],
        referenceAnchor[0],
        center[1],
        center[0],
      )
    : null;

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 top-1/2 items-center"
      style={{ transform: [{ translateY: -28 }] }}
    >
      {distance !== null ? (
        <View className="mb-1 rounded-full bg-black/75 px-3 py-1">
          <Text className="text-xs font-semibold text-white">
            {`${Math.round(distance)} m`}
          </Text>
        </View>
      ) : null}
      <Icon as={MapPinIcon} className="size-10 text-black" fill="#EF4444" />
      <Text className="mt-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
        {stage === 'place-a'
          ? t('components.map.picker-buttons.setA')
          : stage === 'place-b'
            ? t('components.map.picker-buttons.setB')
            : t('components.map.picker-buttons.confirm')}
      </Text>
    </View>
  );
};

const PickerChrome: React.FC<PickerChromeProps> = ({
  stage,
  adjustingAnchor,
  anchorA,
  anchorB,
  center,
  existingHighlinesVisible,
  isSaving,
  isOffline,
  editing,
  onBack,
  onUndo,
  onPick,
  onAdjust,
  onContinue,
  onToggleExistingHighlines,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const canUndo = stage !== 'place-a' && !adjustingAnchor;
  const primaryLabel = adjustingAnchor
    ? t(
        adjustingAnchor === 'a'
          ? 'components.map.location-picker.adjustA'
          : 'components.map.location-picker.adjustB',
      )
    : stage === 'place-a'
      ? t('components.map.picker-buttons.setA')
      : stage === 'place-b'
        ? t('components.map.picker-buttons.setB')
        : t('components.map.picker-buttons.confirm');

  return (
    <>
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-4"
        style={{ top: insets.top + 12 }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('components.onboard.goBack')}
          onPress={onBack}
          className="size-11 items-center justify-center rounded-full bg-white shadow-lg"
        >
          <Icon as={ChevronLeftIcon} className="size-6 text-black" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="switch"
          accessibilityState={{ checked: existingHighlinesVisible }}
          accessibilityLabel={t(
            'components.map.location-picker.existingHighlines',
          )}
          onPress={onToggleExistingHighlines}
          className="flex-row items-center gap-2 rounded-full bg-white px-3 py-2 shadow-lg"
        >
          <Icon
            as={existingHighlinesVisible ? EyeIcon : EyeOffIcon}
            className="size-5 text-black"
          />
          <Text className="text-sm font-semibold text-black">
            {t('components.map.location-picker.existingHighlines')}
          </Text>
        </TouchableOpacity>
      </View>

      <PickerCenter
        stage={stage}
        adjustingAnchor={adjustingAnchor}
        anchorA={anchorA}
        anchorB={anchorB}
        center={center}
      />

      {stage === 'review' ? (
        <View className="absolute bottom-7 left-4 right-4 gap-2 rounded-2xl bg-black/85 p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-white">
              {t('components.map.location-picker.review')}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t(
                'components.map.location-picker.undoAnchorB',
              )}
              onPress={onUndo}
              className="flex-row items-center gap-1 rounded-full bg-white/15 px-3 py-2"
            >
              <Icon as={RotateCcwIcon} className="size-4 text-white" />
              <Text className="text-sm font-semibold text-white">
                {t('components.map.location-picker.undo')}
              </Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('components.map.location-picker.adjustA')}
              onPress={() => onAdjust('a')}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-white/15 px-2 py-3"
            >
              <Icon as={PencilIcon} className="size-4 text-white" />
              <Text className="text-sm font-semibold text-white">
                {t('components.map.location-picker.adjustA')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('components.map.location-picker.adjustB')}
              onPress={() => onAdjust('b')}
              className="flex-1 flex-row items-center justify-center gap-1 rounded-xl bg-white/15 px-2 py-3"
            >
              <Icon as={PencilIcon} className="size-4 text-white" />
              <Text className="text-sm font-semibold text-white">
                {t('components.map.location-picker.adjustB')}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t(
              editing
                ? 'components.map.location-picker.save'
                : 'components.map.location-picker.continue',
            )}
            onPress={onContinue}
            disabled={isSaving || isOffline}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-3 disabled:opacity-50"
          >
            {isSaving ? <ActivityIndicator color="white" /> : null}
            <Icon as={CheckIcon} className="size-5 text-white" />
            <Text className="font-bold text-white">
              {t(
                editing
                  ? 'components.map.location-picker.save'
                  : 'components.map.location-picker.continue',
              )}
            </Text>
          </TouchableOpacity>
          {isOffline && editing ? (
            <Text className="text-center text-xs text-amber-200">
              {t('components.map.location-picker.offlineEdit')}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="absolute bottom-7 left-4 right-4 flex-row items-center rounded-2xl bg-black/85 p-2">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('components.map.location-picker.undo')}
            onPress={onUndo}
            disabled={!canUndo}
            className="size-12 items-center justify-center rounded-xl disabled:opacity-30"
          >
            <Icon as={RotateCcwIcon} className="size-6 text-white" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-base font-semibold text-white">
            {primaryLabel}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            onPress={onPick}
            disabled={isSaving}
            className="size-12 items-center justify-center rounded-xl bg-blue-500 disabled:opacity-50"
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Icon as={MapPinIcon} className="size-6 text-white" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

function finitePosition(
  position: AnchorPosition | null,
): position is AnchorPosition {
  return Boolean(
    position && Number.isFinite(position[0]) && Number.isFinite(position[1]),
  );
}

function draftStage(stage: RegistrationStage | null | undefined): PickerStage {
  return stage === 'place-b' || stage === 'review' ? stage : 'place-a';
}

function derivePickerStage(
  anchorA: AnchorPosition | null,
  anchorB: AnchorPosition | null,
  adjustingAnchor: 'a' | 'b' | null,
): PickerStage {
  if (adjustingAnchor === 'a') return 'place-a';
  if (adjustingAnchor === 'b') return 'place-b';
  if (anchorA && anchorB) return 'review';
  return anchorA ? 'place-b' : 'place-a';
}

function sessionFromRegistration(
  state: HighlineRegistrationState,
  existingHighlinesVisible: boolean,
  adjustingAnchor: 'a' | 'b' | null,
) {
  const draft = state.activeDraft;
  return {
    stage: draftStage(draft?.stage),
    adjustingAnchor,
    anchorA: draft?.anchorA ?? null,
    anchorB: draft?.anchorB ?? null,
    pendingLines: selectPendingMapLines(state),
    existingHighlinesVisible,
  } as const;
}

type NewHighlinePickerProps = {
  request: Extract<LocationPickerRequest, { kind: 'new' }>;
  center: AnchorPosition;
  getCurrentCenter: () => AnchorPosition;
  onBack: () => void;
};

const NewHighlinePicker: React.FC<NewHighlinePickerProps> = (props) => {
  const { profile, session, sessionLoading } = useAuth();
  const ownerId = session?.user.id ?? profile?.id;

  if (sessionLoading) {
    return (
      <View className="absolute inset-0 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (!ownerId) return null;

  return (
    <NewHighlinePickerForOwner key={ownerId} {...props} ownerId={ownerId} />
  );
};

const NewHighlinePickerForOwner: React.FC<
  NewHighlinePickerProps & { ownerId: string }
> = ({ center, getCurrentCenter, onBack, ownerId }) => {
  const {
    state: registration,
    store,
    isLoaded,
  } = useRegistrationState(ownerId);
  const isHydrating = !isLoaded;
  const [adjustingAnchor, setAdjustingAnchor] = useState<'a' | 'b' | null>(
    null,
  );
  const [existingHighlinesVisible, setExistingHighlinesVisible] =
    useState(true);
  const setLocationPickerSession = useMapStore(
    (state) => state.setLocationPickerSession,
  );
  const clearLocationPickerRequest = useMapStore(
    (state) => state.clearLocationPickerRequest,
  );
  const navigation = useRouter();

  const publish = useCallback(
    (
      next: HighlineRegistrationState,
      nextAdjustingAnchor: 'a' | 'b' | null = adjustingAnchor,
    ) => {
      setLocationPickerSession(
        sessionFromRegistration(
          next,
          existingHighlinesVisible,
          nextAdjustingAnchor,
        ),
      );
    },
    [adjustingAnchor, existingHighlinesVisible, setLocationPickerSession],
  );

  useMountEffect(() => {
    let mounted = true;

    void store.load().then(async (loaded) => {
      if (!mounted) return;

      const next = loaded.activeDraft
        ? loaded
        : await store.dispatch({ type: 'start' });

      if (mounted) publish(next, null);
    });

    return () => {
      mounted = false;
    };
  });

  const applyAction = useCallback(
    async (
      action: RegistrationAction,
      nextAdjustingAnchor = adjustingAnchor,
    ) => {
      const next = await store.dispatch(action);
      publish(next, nextAdjustingAnchor);
      return next;
    },
    [adjustingAnchor, publish, store],
  );

  const draft = registration.activeDraft;
  const stage = draftStage(draft?.stage);
  const anchorA = draft?.anchorA ?? null;
  const anchorB = draft?.anchorB ?? null;

  const handleBack = useCallback(() => {
    void store.dispatch({ type: 'exit' }).then(() => {
      setLocationPickerSession(null);
      onBack();
    });
  }, [onBack, setLocationPickerSession, store]);

  const handleUndo = useCallback(() => {
    if (adjustingAnchor) return;
    void applyAction({ type: 'undo' });
  }, [adjustingAnchor, applyAction]);

  const handlePick = useCallback(() => {
    const currentCenter = getCurrentCenter();
    if (isHydrating || !finitePosition(currentCenter)) return;

    void (async () => {
      let current = store.getState();
      if (!current.activeDraft) {
        current = await store.dispatch({ type: 'start' });
      }

      const currentStage = current.activeDraft?.stage;
      if (adjustingAnchor) {
        await applyAction(
          {
            type: 'adjust',
            anchor: adjustingAnchor,
            position: currentCenter,
          },
          null,
        );
        setAdjustingAnchor(null);
      } else if (currentStage === 'place-a') {
        await applyAction({ type: 'place-a', position: currentCenter });
      } else if (currentStage === 'place-b') {
        await applyAction({ type: 'place-b', position: currentCenter });
      }
    })();
  }, [adjustingAnchor, applyAction, getCurrentCenter, isHydrating, store]);

  const handleAdjust = useCallback(
    (anchor: 'a' | 'b') => {
      if (stage !== 'review') return;
      setAdjustingAnchor(anchor);
      applyAction({ type: 'begin-adjust', anchor }, anchor);
    },
    [applyAction, stage],
  );

  const handleContinue = useCallback(() => {
    if (!draft || !draft.anchorA || !draft.anchorB) return;

    clearLocationPickerRequest();
    navigation.push({
      pathname: '/register-highline',
      params: {
        anchorA: JSON.stringify(draft.anchorA),
        anchorB: JSON.stringify(draft.anchorB),
        draftId: draft.draftId,
      },
    });
  }, [clearLocationPickerRequest, draft, navigation]);

  const handleToggleExistingHighlines = useCallback(() => {
    setExistingHighlinesVisible((visible) => {
      const nextVisible = !visible;
      setLocationPickerSession(
        sessionFromRegistration(store.getState(), nextVisible, adjustingAnchor),
      );
      return nextVisible;
    });
  }, [adjustingAnchor, setLocationPickerSession, store]);

  return (
    <PickerChrome
      stage={stage}
      adjustingAnchor={adjustingAnchor}
      anchorA={anchorA}
      anchorB={anchorB}
      center={center}
      existingHighlinesVisible={existingHighlinesVisible}
      isSaving={isHydrating}
      isOffline={false}
      editing={false}
      onBack={handleBack}
      onUndo={handleUndo}
      onPick={handlePick}
      onAdjust={handleAdjust}
      onContinue={handleContinue}
      onToggleExistingHighlines={handleToggleExistingHighlines}
    />
  );
};

const ExistingHighlinePicker: React.FC<{
  request: Extract<LocationPickerRequest, { kind: 'edit' }>;
  center: AnchorPosition;
  getCurrentCenter: () => AnchorPosition;
  onBack: () => void;
}> = ({ request, center, getCurrentCenter, onBack }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const [anchorA, setAnchorA] = useState<AnchorPosition | null>(
    request.anchorA,
  );
  const [anchorB, setAnchorB] = useState<AnchorPosition | null>(
    request.anchorB,
  );
  const [adjustingAnchor, setAdjustingAnchor] = useState<'a' | 'b' | null>(
    null,
  );
  const [existingHighlinesVisible, setExistingHighlinesVisible] =
    useState(true);
  const setLocationPickerSession = useMapStore(
    (state) => state.setLocationPickerSession,
  );
  const clearLocationPickerRequest = useMapStore(
    (state) => state.clearLocationPickerRequest,
  );

  const stage: PickerStage = adjustingAnchor
    ? adjustingAnchor === 'a'
      ? 'place-a'
      : 'place-b'
    : anchorA && anchorB
      ? 'review'
      : anchorA
        ? 'place-b'
        : 'place-a';

  const publish = useCallback(
    (
      nextAnchorA: AnchorPosition | null,
      nextAnchorB: AnchorPosition | null,
      nextAdjustingAnchor: 'a' | 'b' | null = adjustingAnchor,
      nextVisible = existingHighlinesVisible,
    ) => {
      setLocationPickerSession({
        stage: derivePickerStage(nextAnchorA, nextAnchorB, nextAdjustingAnchor),
        adjustingAnchor: nextAdjustingAnchor,
        anchorA: nextAnchorA,
        anchorB: nextAnchorB,
        pendingLines: [],
        existingHighlinesVisible: nextVisible,
      });
    },
    [adjustingAnchor, existingHighlinesVisible, setLocationPickerSession],
  );

  useMountEffect(() => {
    publish(anchorA, anchorB, null);
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({
      nextAnchorA,
      nextAnchorB,
    }: {
      nextAnchorA: AnchorPosition;
      nextAnchorB: AnchorPosition;
    }) => {
      const length = haversineDistance(
        nextAnchorA[1],
        nextAnchorA[0],
        nextAnchorB[1],
        nextAnchorB[0],
      );
      const { error } = await supabase
        .from('highline')
        .update({
          anchor_a: positionToPostGISPoint(nextAnchorA),
          anchor_b: positionToPostGISPoint(nextAnchorB),
          length: Math.round(length),
        })
        .eq('id', request.highlineId);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.list(),
      });
      await queryClient.invalidateQueries({
        queryKey: highlineKeyFactory.detail(request.highlineId),
      });
      clearLocationPickerRequest();
      router.back();
    },
  });

  const handleBack = useCallback(() => {
    clearLocationPickerRequest();
    onBack();
  }, [clearLocationPickerRequest, onBack]);

  const handleUndo = useCallback(() => {
    if (adjustingAnchor) return;
    if (stage === 'review') {
      setAnchorB(null);
      publish(anchorA, null, null);
    } else if (stage === 'place-b') {
      setAnchorA(null);
      setAnchorB(null);
      publish(null, null, null);
    }
  }, [adjustingAnchor, anchorA, publish, stage]);

  const handlePick = useCallback(() => {
    const currentCenter = getCurrentCenter();
    if (!finitePosition(currentCenter)) return;

    if (adjustingAnchor === 'a') {
      setAnchorA(currentCenter);
      setAnchorB(null);
      setAdjustingAnchor(null);
      publish(currentCenter, null, null);
      return;
    }
    if (adjustingAnchor === 'b') {
      setAnchorB(currentCenter);
      setAdjustingAnchor(null);
      publish(anchorA, currentCenter, null);
      return;
    }
    if (stage === 'place-a') {
      setAnchorA(currentCenter);
      publish(currentCenter, null, null);
    } else if (stage === 'place-b') {
      setAnchorB(currentCenter);
      publish(anchorA, currentCenter, null);
    }
  }, [adjustingAnchor, anchorA, getCurrentCenter, publish, stage]);

  const handleAdjust = useCallback(
    (anchor: 'a' | 'b') => {
      if (stage !== 'review') return;
      setAdjustingAnchor(anchor);
      publish(
        anchor === 'a' ? null : anchorA,
        anchor === 'a' ? null : null,
        anchor,
      );
    },
    [anchorA, publish, stage],
  );

  const handleContinue = useCallback(() => {
    if (!isOnline || !anchorA || !anchorB) return;
    updateLocationMutation.mutate({
      nextAnchorA: anchorA,
      nextAnchorB: anchorB,
    });
  }, [anchorA, anchorB, isOnline, updateLocationMutation]);

  const handleToggleExistingHighlines = useCallback(() => {
    setExistingHighlinesVisible((visible) => {
      const nextVisible = !visible;
      publish(anchorA, anchorB, adjustingAnchor, nextVisible);
      return nextVisible;
    });
  }, [adjustingAnchor, anchorA, anchorB, publish]);

  return (
    <PickerChrome
      stage={stage}
      adjustingAnchor={adjustingAnchor}
      anchorA={anchorA}
      anchorB={anchorB}
      center={center}
      existingHighlinesVisible={existingHighlinesVisible}
      isSaving={updateLocationMutation.isPending}
      isOffline={!isOnline}
      editing
      onBack={handleBack}
      onUndo={handleUndo}
      onPick={handlePick}
      onAdjust={handleAdjust}
      onContinue={handleContinue}
      onToggleExistingHighlines={handleToggleExistingHighlines}
    />
  );
};

export const HighlinePickerOverlay: React.FC<{
  request: LocationPickerRequest;
  getCurrentCenter: () => AnchorPosition;
  onBack: () => void;
}> = ({ request, getCurrentCenter, onBack }) => {
  const center = useMapStore((state) => state.camera.center) as AnchorPosition;

  if (request.kind === 'new') {
    return (
      <NewHighlinePicker
        request={request}
        center={center}
        getCurrentCenter={getCurrentCenter}
        onBack={onBack}
      />
    );
  }

  return (
    <ExistingHighlinePicker
      request={request}
      center={center}
      getCurrentCenter={getCurrentCenter}
      onBack={onBack}
    />
  );
};
