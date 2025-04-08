import { Link } from 'expo-router';
import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity, View } from 'react-native';
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
  useUserWebbings,
  useWebbing,
  WebbingWithModel,
} from '~/hooks/use-webbings';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { cn } from '~/lib/utils';

import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectTriggerSkeleton,
  SelectValue,
  type Option,
} from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Skeleton } from '~/components/ui/skeleton';
import { Text } from '~/components/ui/text';
import { WebbingInput } from '~/components/webbing-input';

const DAMPING = 14;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);

export const WebForm: React.FC = () => {
  const {
    form,
    main,
    backup,
    focusedWebbing,
    setFocusedWebbing,
    getWebbingName,
  } = useRiggingForm();

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
        {t('components.webbing-setup.webbingOwner.label')}
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
  const [triggerWidth, setTriggerWidth] = useState(0);
  const { data, isPending } = useUserWebbings();

  // Access the current rigging form values
  const { main, backup, focusedWebbing, getWebbingName } = useRiggingForm();

  // Build a set of IDs of webbings that are in use on the current form
  const usedWebbingIds = new Set<string>();
  main.fields.forEach((item, index) => {
    const isSelected =
      focusedWebbing?.type === 'main' && focusedWebbing.index === index;
    if (!isSelected && item.webbingId) {
      usedWebbingIds.add(item.webbingId);
    }
  });
  backup.fields.forEach((item, index) => {
    const isSelected =
      focusedWebbing?.type === 'main' && focusedWebbing.index === index;
    if (!isSelected && item.webbingId) {
      usedWebbingIds.add(item.webbingId);
    }
  });

  const getDefaultValue = (): Option | undefined => {
    if (!webbing.webbingId) return undefined;
    const selectedWebbingData = data?.find(
      (web) => web.id.toString() === webbing.webbingId,
    );
    if (!selectedWebbingData) return undefined;
    return {
      value: selectedWebbingData.id.toString(),
      label: getWebbingName(selectedWebbingData),
    };
  };

  return (
    <View className="gap-2 w-full">
      <Label htmlFor={id} nativeID={id}>
        {t('components.webbing-setup.selectMyWebbing.label')}
      </Label>

      {isPending ? (
        <SelectTriggerSkeleton />
      ) : (
        <Select
          defaultValue={getDefaultValue()}
          onValueChange={(opt) => {
            if (opt) {
              const selectedWeb = data?.find(
                (web) => web.id.toString() === opt.value,
              );
              if (selectedWeb) onSelectWebbing(selectedWeb);
            } else {
              onSelectWebbing(null);
            }
          }}
        >
          <SelectTrigger
            id={id}
            aria-labelledby={id}
            onLayout={(e) => {
              const { width } = e.nativeEvent.layout;
              setTriggerWidth(width);
            }}
          >
            <SelectValue
              className={cn(
                webbing.webbingId ? 'text-primary' : 'text-muted-foreground',
              )}
              placeholder={t(
                'components.webbing-setup.selectMyWebbing.placeholder',
              )}
            />
          </SelectTrigger>
          <SelectContent style={{ width: triggerWidth }}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              {data?.map((item) => {
                const itemId = item.id.toString();
                const isUsed = usedWebbingIds.has(itemId) || item.isUsed;
                const inUseLabel = t(
                  'components.webbing-setup.selectMyWebbing.inUse',
                );
                const label =
                  getWebbingName(item) + (isUsed ? ` ${inUseLabel}` : '');
                return (
                  <SelectItem
                    key={item.id}
                    value={itemId}
                    label={label}
                    disabled={isUsed}
                  />
                );
              })}
              <Separator />
              <Button variant="ghost" onPress={() => onSelectWebbing(null)}>
                <Text>
                  {t('components.webbing-setup.selectMyWebbing.clear')}
                </Text>
              </Button>
            </ScrollView>
          </SelectContent>
        </Select>
      )}
    </View>
  );
};
