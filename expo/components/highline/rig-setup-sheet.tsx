import type { RiggerProfile } from '@chooselife/ui';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRightIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useResolveClassNames } from 'uniwind';

import { Icon } from '~/components/ui/icon';
import { SegmentedControl } from '~/components/ui/segmented-control';
import { Text } from '~/components/ui/text';
import { ReadOnlySetupCanvas } from '~/components/webbing-setup/read-only-setup-canvas';

import {
  BACKUP_WEBBING_COLOR,
  formatMeters,
  formatUsername,
  MAIN_WEBBING_COLOR,
  RiggerAvatars,
  splitWebbing,
  StatusPill,
  useRiggerCountLabel,
  useSetupDays,
  useWebbingLabels,
  type RiggerProfiles,
  type RigSetup,
  type SetupWebbing,
} from './rig-setup-display';

/** Opens the details sheet through the `setupDetailsID` URL param. */
export function useOpenRigSetupSheet() {
  const router = useRouter();
  return (setup: RigSetup) =>
    router.setParams({ setupDetailsID: String(setup.id) });
}

/**
 * Read-only details of one rig setup. Like `RigModal`, it is driven by a URL
 * param so a setup can be deep-linked.
 */
export const RigSetupSheet: React.FC<{
  setups: RigSetup[] | undefined;
  profiles: RiggerProfiles;
  highlineLength: number;
}> = ({ setups, profiles, highlineLength }) => {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { setupDetailsID } = useLocalSearchParams<{
    setupDetailsID?: string;
  }>();
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const backgroundStyle = useResolveClassNames('bg-background');
  const handleIndicatorStyle = useResolveClassNames('bg-muted-foreground');

  const setup = setups?.find((s) => String(s.id) === setupDetailsID);

  React.useEffect(() => {
    if (setup) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [setup]);

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

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      maxDynamicContentSize={height * 0.9}
      backgroundStyle={[
        backgroundStyle,
        { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
      ]}
      handleIndicatorStyle={handleIndicatorStyle}
      onDismiss={() => {
        if (setupDetailsID) router.setParams({ setupDetailsID: undefined });
      }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {setup ? (
          // Keyed so each setup opens on the first tab.
          <SheetContent
            key={setup.id}
            setup={setup}
            profiles={profiles}
            highlineLength={highlineLength}
          />
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

type SheetTab = 'webbing' | 'riggers';

const SheetContent: React.FC<{
  setup: RigSetup;
  profiles: RiggerProfiles;
  highlineLength: number;
}> = ({ setup, profiles, highlineLength }) => {
  const { t } = useTranslation();
  const { status, label, dateText, statusLabel } = useSetupDays(setup);
  const [tab, setTab] = useState<SheetTab>('webbing');

  return (
    <View className="gap-6 px-5 pt-2">
      <View className="gap-2">
        <StatusPill status={status} label={statusLabel} />
        <Text className="text-2xl font-bold text-foreground">{label}</Text>
        {dateText ? (
          <Text className="text-base text-muted-foreground">{dateText}</Text>
        ) : null}
      </View>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          {
            value: 'webbing',
            label: t('components.highline.history.details.webbing'),
          },
          {
            value: 'riggers',
            label: t('components.highline.history.details.riggers'),
          },
        ]}
      />

      {tab === 'webbing' ? (
        <WebbingTab setup={setup} highlineLength={highlineLength} />
      ) : (
        <RiggersTab riggers={setup.riggers} profiles={profiles} />
      )}
    </View>
  );
};

const WebbingTab: React.FC<{ setup: RigSetup; highlineLength: number }> = ({
  setup,
  highlineLength,
}) => {
  const { t } = useTranslation();
  const { main, backup, mainTotal, backupTotal, hasWebbing } =
    splitWebbing(setup);

  if (!hasWebbing) {
    return (
      <View className="items-center rounded-2xl bg-muted py-6">
        <Text className="text-muted-foreground">
          {t('components.highline.history.details.empty')}
        </Text>
      </View>
    );
  }

  const toCanvasSection = (w: SetupWebbing) => ({
    length: Number(w.length),
    leftLoop: w.left_loop,
    rightLoop: w.right_loop,
  });

  return (
    <View className="gap-4">
      <ReadOnlySetupCanvas
        main={main.map(toCanvasSection)}
        backup={backup.map(toCanvasSection)}
      />
      <WebbingGroup
        title={t('components.highline.history.details.main')}
        color={MAIN_WEBBING_COLOR}
        total={mainTotal}
        sections={main}
      />
      <WebbingGroup
        title={t('components.highline.history.details.backup')}
        color={BACKUP_WEBBING_COLOR}
        total={backupTotal}
        sections={backup}
      />
      <View className="flex-row justify-between border-t border-border pt-3">
        <Text className="text-sm text-muted-foreground">
          {t('components.highline.history.details.highlineLength')}
        </Text>
        <Text className="text-sm font-semibold text-foreground">
          {formatMeters(highlineLength)}
        </Text>
      </View>
    </View>
  );
};

const WebbingGroup: React.FC<{
  title: string;
  color: string;
  total: number;
  sections: SetupWebbing[];
}> = ({ title, color, total, sections }) => {
  const labels = useWebbingLabels();
  if (sections.length === 0) return null;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="h-1.5 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <Text className="font-semibold text-foreground">{title}</Text>
        </View>
        <Text className="font-semibold text-foreground">
          {formatMeters(total)}
        </Text>
      </View>
      {sections.map((w) => {
        const note = labels.note(w);
        return (
          <View key={w.id} className="flex-row justify-between gap-3 pl-6">
            <View className="flex-1">
              <Text className="text-sm text-foreground">{labels.name(w)}</Text>
              <Text className="text-xs text-muted-foreground">
                {labels.loops(w)}
              </Text>
              {note ? (
                <Text className="text-xs text-muted-foreground">{note}</Text>
              ) : null}
            </View>
            <Text className="text-sm text-foreground">
              {formatMeters(Number(w.length))}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const RiggersTab: React.FC<{
  riggers: string[];
  profiles: RiggerProfiles;
}> = ({ riggers, profiles }) => {
  const router = useRouter();
  const emptyLabel = useRiggerCountLabel(0);

  // The sheet is a root-level modal and would stay over the next screen, so
  // clear its param (it dismisses itself) before navigating.
  const goToProfile = (profile?: RiggerProfile) => {
    if (!profile?.username) return;
    router.setParams({ setupDetailsID: undefined });
    router.push({
      pathname: '/profile/[username]',
      params: { username: profile.username },
    });
  };

  if (riggers.length === 0) {
    return <Text className="text-muted-foreground">{emptyLabel}</Text>;
  }

  return (
    <View className="gap-3">
      {riggers.map((id) => {
        const profile = profiles?.get(id);
        return (
          <Pressable
            key={id}
            onPress={() => goToProfile(profile)}
            className="flex-row items-center gap-3 rounded-xl py-1 active:bg-muted"
          >
            <RiggerAvatars riggers={[id]} profiles={profiles} size={40} />
            <View className="flex-1">
              <Text className="font-semibold text-foreground">
                {profile?.name ?? '—'}
              </Text>
              {profile?.username ? (
                <Text className="text-sm text-muted-foreground">
                  {formatUsername(profile.username)}
                </Text>
              ) : null}
            </View>
            <Icon
              as={ChevronRightIcon}
              className="size-4 text-muted-foreground"
            />
          </Pressable>
        );
      })}
    </View>
  );
};
