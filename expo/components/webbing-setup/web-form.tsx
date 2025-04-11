import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Link, useRouter } from 'expo-router';
import { useCallback, useId, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import {
  useRiggingForm,
  type WebbingSchemaWithPreffiled,
  type WebType,
} from '~/context/rig-form';
import { useProfile } from '~/hooks/use-profile';
import {
  getWebbingName,
  useUserWebbings,
  useWebbing,
  WebbingWithModel,
  WebbingWithUsage,
} from '~/hooks/use-webbings';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { WebbingInput } from '~/components/webbing-input';

const DAMPING = 14;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);

export const WebForm: React.FC = () => {
  const { form, main, backup, focusedWebbing, setFocusedWebbing } =
    useRiggingForm();

  if (!focusedWebbing) return null;

  const webbing = form.watch(
    `webbing.${focusedWebbing.type}.${focusedWebbing.index}`,
  );

  const handleDeleteSection = useCallback(
    (type: WebType, index: number) => {
      if (type === 'main') {
        main.remove(index);
      } else {
        backup.remove(index);
      }
      setFocusedWebbing(null);
    },
    [main, backup],
  );

  const handleLoopChange = useCallback(
    (loopType: 'leftLoop' | 'rightLoop') => (checked: boolean) => {
      if (!focusedWebbing) return;
      const path =
        `webbing.${focusedWebbing.type}.${focusedWebbing.index}` as const;
      const webbing = form.getValues(path);
      const updatedWebbing: WebbingSchemaWithPreffiled = {
        ...webbing,
        ...(loopType === 'leftLoop' ? { leftLoop: checked } : {}),
        ...(loopType === 'rightLoop' ? { rightLoop: checked } : {}),
      };
      if (focusedWebbing.type === 'main') {
        main.update(focusedWebbing.index, updatedWebbing);
      } else {
        backup.update(focusedWebbing.index, updatedWebbing);
      }
    },
    [focusedWebbing, form, main, backup],
  );

  const handleChangeLength = useCallback(
    (txt: string) => {
      if (!focusedWebbing) return;
      const path =
        `webbing.${focusedWebbing.type}.${focusedWebbing.index}` as const;
      const webbing = form.getValues(path);
      const updatedWebbing: WebbingSchemaWithPreffiled = {
        ...webbing,
        length: txt,
      };
      if (focusedWebbing.type === 'main') {
        main.update(focusedWebbing.index, updatedWebbing);
      } else {
        backup.update(focusedWebbing.index, updatedWebbing);
      }
    },
    [focusedWebbing, form, main, backup],
  );

  const handleSelectWebbing = useCallback(
    (webbing: WebbingWithModel[number] | null) => {
      if (!focusedWebbing) return;
      const path =
        `webbing.${focusedWebbing.type}.${focusedWebbing.index}` as const;
      const formWebbing = form.getValues(path);
      const updatedWebbing: WebbingSchemaWithPreffiled = {
        ...formWebbing,
        ...(webbing
          ? {
              webbingId: webbing.id.toString(),
              leftLoop: webbing.left_loop,
              rightLoop: webbing.right_loop,
              length: webbing.length.toString(),
              tagName: getWebbingName(webbing),
            }
          : { webbingId: undefined }),
      };
      if (focusedWebbing.type === 'main') {
        main.update(focusedWebbing.index, updatedWebbing);
      } else {
        backup.update(focusedWebbing.index, updatedWebbing);
      }
    },
    [focusedWebbing, form, main, backup],
  );

  return (
    <Animated.View
      entering={_enteringAnimation}
      exiting={_exitingAnimation}
      className="flex-1 items-center gap-6"
    >
      <View className="flex-row justify-between w-full">
        <TouchableOpacity
          onPress={() => setFocusedWebbing(null)}
          className="p-1"
        >
          <LucideIcon
            name="ChevronLeft"
            size={16}
            className="text-primary text-center"
          />
        </TouchableOpacity>

        {webbing.webbingId && <WebbingOwner webbingID={+webbing.webbingId} />}

        <TouchableOpacity onPress={() => handleDeleteSection} className="p-1">
          <LucideIcon
            name="Trash"
            size={16}
            className="text-red-500 text-center"
          />
        </TouchableOpacity>
      </View>
      <SelectMyWebbing
        webbing={webbing}
        onSelectWebbing={handleSelectWebbing}
      />
      <WebbingInput
        leftLoop={webbing.leftLoop}
        rightLoop={webbing.rightLoop}
        length={webbing.length.toString()}
        disabled={!!webbing.webbingId}
        onLeftLoopChange={handleLoopChange('leftLoop')}
        onRightLoopChange={handleLoopChange('rightLoop')}
        onLengthChange={handleChangeLength}
      />
    </Animated.View>
  );
};

const WebbingOwner: React.FC<{ webbingID: number }> = ({ webbingID }) => {
  const { t } = useTranslation();
  const { data } = useWebbing(webbingID);

  if (!data) return null;

  const { data: owner, isPending } = useProfile(data.user_id);

  if (isPending) {
    return <Skeleton className="w-10 h-4" />;
  }

  if (!owner || !owner.username) return null;

  return (
    <View className="flex-row max-w-56 overflow-hidden">
      <Text className="text-muted-foreground">
        {t('components.webbing-setup.webbingOwner.label')}{' '}
      </Text>
      <Link
        href={{
          pathname: '/profile/[username]',
          params: { username: owner.username },
        }}
      >
        <Text className="text-blue-500" numberOfLines={1}>
          {owner.username}
        </Text>
      </Link>
    </View>
  );
};

const SelectMyWebbing: React.FC<{
  webbing: WebbingSchemaWithPreffiled;
  onSelectWebbing: (webbing: WebbingWithModel[number] | null) => void;
}> = ({ webbing, onSelectWebbing }) => {
  const { t } = useTranslation();
  const id = useId();
  const { data, isLoading } = useUserWebbings();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const router = useRouter();

  // Access the current rigging form values
  const { main, backup, focusedWebbing } = useRiggingForm();

  // Memoize the calculation of used webbing IDs
  const usedWebbingIds = useMemo(() => {
    const ids = new Set<string>();

    main.fields.forEach((item, index) => {
      const isSelected =
        focusedWebbing?.type === 'main' && focusedWebbing.index === index;
      if (!isSelected && item.webbingId) {
        ids.add(item.webbingId);
      }
    });

    backup.fields.forEach((item, index) => {
      const isSelected =
        focusedWebbing?.type === 'backup' && focusedWebbing.index === index;
      if (!isSelected && item.webbingId) {
        ids.add(item.webbingId);
      }
    });

    return ids;
  }, [main.fields, backup.fields, focusedWebbing]);

  // Memoize the selected webbing information
  const selectedWebbingName = useMemo(
    () =>
      webbing.webbingId
        ? data?.find((web) => web.id.toString() === webbing.webbingId)
        : null,
    [webbing.webbingId, data],
  );

  const handleSelect = useCallback(
    (selectedWebbing: WebbingWithModel[number] | null) => {
      onSelectWebbing(selectedWebbing);
      bottomSheetModalRef.current?.close();
    },
    [onSelectWebbing],
  );

  const handleOpenPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleRegisterNewWebbing = useCallback(() => {
    bottomSheetModalRef.current?.close();
    router.push('/(modals)/register-webbing');
  }, [router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Memoize the selector button to prevent re-renders
  const SelectorButton = useMemo(
    () => (
      <TouchableOpacity
        id={id}
        onPress={handleOpenPress}
        className="flex-row justify-between items-center px-4 py-3 rounded-md border border-input bg-background"
      >
        <Text
          className={
            selectedWebbingName ? 'text-primary' : 'text-muted-foreground'
          }
        >
          {selectedWebbingName
            ? getWebbingName(selectedWebbingName)
            : t('components.webbing-setup.selectMyWebbing.placeholder')}
        </Text>
        <LucideIcon name="ChevronDown" className="text-foreground" />
      </TouchableOpacity>
    ),
    [id, handleOpenPress, selectedWebbingName, getWebbingName, t],
  );

  // Extract the webbing item rendering logic with useCallback
  const renderWebbingItem = useCallback(
    (item: WebbingWithUsage) => {
      const itemId = item.id.toString();
      const isUsed = usedWebbingIds.has(itemId) || item.isUsed;
      const inUseLabel = t('components.webbing-setup.selectMyWebbing.inUse');
      const label = getWebbingName(item) + (isUsed ? ` ${inUseLabel}` : '');

      return (
        <TouchableOpacity
          key={item.id}
          onPress={() => !isUsed && handleSelect(item)}
          disabled={isUsed}
          className={cn(
            'flex-row justify-between items-center py-3 px-4 mb-1 rounded-md',
            isUsed ? 'opacity-50' : 'active:bg-muted',
            itemId === webbing.webbingId && 'bg-primary/20',
          )}
        >
          <Text
            className={cn('text-foreground', isUsed && 'text-muted-foreground')}
          >
            {label}
          </Text>

          <View className="flex flex-row gap-2 items-center">
            <LucideIcon
              name="MoveHorizontal"
              className={cn(
                'text-foreground',
                isUsed && 'text-muted-foreground',
              )}
            />
            <Text
              className={cn(
                'text-foreground',
                isUsed && 'text-muted-foreground',
              )}
            >
              {item.length}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [usedWebbingIds, getWebbingName, t, webbing.webbingId, handleSelect],
  );

  // Memoize the register button that will always be shown
  const RegisterButton = useMemo(
    () => (
      <Button
        onPress={handleRegisterNewWebbing}
        variant="link"
        className="w-full mt-2"
      >
        <Text className="text-blue-500">
          {t('components.webbing-setup.selectMyWebbing.registerButton')}
        </Text>
      </Button>
    ),
    [handleRegisterNewWebbing, t],
  );

  // Memoize the empty state component
  const EmptyState = useMemo(
    () => (
      <View className="items-center justify-center py-10 gap-4">
        <LucideIcon
          name="PackagePlus"
          size={48}
          className="text-muted-foreground"
        />
        <Text className="text-center text-lg font-medium">
          {t('components.webbing-setup.selectMyWebbing.emptyState.title')}
        </Text>
        <Text className="text-center text-muted-foreground mb-4">
          {t('components.webbing-setup.selectMyWebbing.emptyState.description')}
        </Text>
        {RegisterButton}
      </View>
    ),
    [t, RegisterButton],
  );

  // Memoize the webbing list component
  const WebbingList = useMemo(
    () => (
      <>
        {data?.map(renderWebbingItem)}
        {RegisterButton}

        <Separator className="my-3" />
        <Button
          variant="ghost"
          onPress={() => handleSelect(null)}
          className="mt-2"
        >
          <Text>{t('components.webbing-setup.selectMyWebbing.clear')}</Text>
        </Button>
      </>
    ),
    [data, renderWebbingItem, t, handleSelect, RegisterButton],
  );

  const BottomSheetContent = useMemo(
    () => (
      <View className="flex-1 p-4">
        <Text className="text-lg font-semibold text-center mb-4">
          {t('components.webbing-setup.selectMyWebbing.label')}
        </Text>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {data && data.length > 0 ? WebbingList : EmptyState}
        </ScrollView>
      </View>
    ),
    [t, data, WebbingList, EmptyState],
  );

  return (
    <View className="gap-2 w-full">
      <Label htmlFor={id} nativeID={id}>
        {t('components.webbing-setup.selectMyWebbing.label')}
      </Label>

      {isLoading ? (
        <Skeleton className="w-full h-12 rounded-md" />
      ) : (
        <>
          {SelectorButton}

          <BottomSheetModal
            ref={bottomSheetModalRef}
            snapPoints={['60%']}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={{ backgroundColor: '#999' }}
            enableDynamicSizing={false}
          >
            {BottomSheetContent}
          </BottomSheetModal>
        </>
      )}
    </View>
  );
};
