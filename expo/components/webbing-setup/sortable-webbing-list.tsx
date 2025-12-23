import {
  AlertTriangleIcon,
  CirclePlusIcon,
  GripVerticalIcon,
  MoveHorizontalIcon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOut,
  interpolate,
  interpolateColor,
  LinearTransition,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import type {
  FocusedWebbing,
  WebbingWithId,
  WebType,
} from '~/context/rig-form';
import { useWebbing } from '~/hooks/use-webbings';
import { cn } from '~/lib/utils';
import { DAMPING } from '~/utils/constants';

import { SupabaseAvatar } from '~/components/supabase-avatar';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from '~/components/ui/alert';
import { Icon } from '~/components/ui/icon';
import { Text } from '~/components/ui/text';
import type { WebbingValidationErrors } from '~/components/webbing-setup/setup-canvas';

export const ROW_HEIGHT = 48;

const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
const _exitingAnimation = FadeOut.springify().damping(DAMPING);
const _enteringAnimation = FadeInDown.springify().damping(DAMPING);

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const WebList: React.FC<{
  mainSections: WebbingWithId[];
  backupSections: WebbingWithId[];
  handleNewSection: (type: WebType) => void;
  swapMain: (fromIndex: number, toIndex: number) => void;
  swapBackup: (fromIndex: number, toIndex: number) => void;
  setFocusedWebbing: React.Dispatch<React.SetStateAction<FocusedWebbing>>;
  errorMessages: WebbingValidationErrors;
}> = ({
  mainSections,
  backupSections,
  handleNewSection,
  swapMain,
  swapBackup,
  setFocusedWebbing,
  errorMessages,
}) => {
  return (
    <Animated.View
      entering={_enteringAnimation}
      exiting={_exitingAnimation}
      className="flex-1 items-center gap-4"
    >
      <WebListSection
        type="main"
        webbings={mainSections}
        errorMessage={errorMessages['main']}
        handleNewSection={handleNewSection}
        swap={swapMain}
        setFocusedWebbing={setFocusedWebbing}
      />
      <WebListSection
        type="backup"
        webbings={backupSections}
        errorMessage={errorMessages['backup'] || errorMessages['connection']}
        handleNewSection={handleNewSection}
        swap={swapBackup}
        setFocusedWebbing={setFocusedWebbing}
      />
    </Animated.View>
  );
};

const WebListSection: React.FC<{
  webbings: WebbingWithId[];
  type: WebType;
  errorMessage?: string;
  handleNewSection: (type: WebType) => void;
  swap: (fromIndex: number, toIndex: number) => void;
  setFocusedWebbing: React.Dispatch<React.SetStateAction<FocusedWebbing>>;
}> = ({
  webbings,
  type,
  errorMessage,
  handleNewSection,
  swap,
  setFocusedWebbing,
}) => {
  const currentWebPositions = useSharedValue<TWebPositions>(
    getInitialPositions(webbings),
  );

  // used to know if drag is happening or not
  const isDragging = useSharedValue<0 | 1>(0);

  // this will hold id for item which user started dragging
  const draggedItemId = useSharedValue<null | string>(null);

  return (
    <View className="flex-row gap-1">
      <Animated.View
        layout={_layoutAnimation}
        className={cn(
          'h-full w-1 rounded',
          type === 'main' ? 'bg-red-500' : 'bg-blue-500',
        )}
      />
      <View className="py-2 gap-4 w-full">
        <View
          style={{ position: 'relative', height: webbings.length * ROW_HEIGHT }}
        >
          {webbings.map((webbing, index) => (
            <WebRow
              key={webbing.id}
              webbing={webbing}
              totalItems={webbings.length}
              index={index}
              swap={swap}
              currentWebPositions={currentWebPositions}
              isDragging={isDragging}
              draggedItemId={draggedItemId}
              onPressWebbing={() => setFocusedWebbing({ index, type })}
            />
          ))}
        </View>
        {errorMessage && (
          <Alert variant="warning">
            <AlertContent>
              <AlertDescription>{errorMessage}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
        <AddSectionButton type={type} handleNewSection={handleNewSection} />
      </View>
    </View>
  );
};

const WebRow: React.FC<{
  webbing: WebbingWithId;
  index: number;
  totalItems: number;
  currentWebPositions: SharedValue<TWebPositions>;
  isDragging: SharedValue<0 | 1>;
  draggedItemId: SharedValue<null | string>;
  swap: (from: number, to: number) => void;
  onPressWebbing: () => void;
}> = ({
  webbing,
  index,
  totalItems,
  currentWebPositions,
  isDragging,
  draggedItemId,
  swap,
  onPressWebbing,
}) => {
  const POSITION = index + 1;

  // used for swapping with currentIndex
  const newIndex = useSharedValue<null | number>(null);

  // used for swapping with newIndex
  const currentIndex = useSharedValue<null | number>(null);

  const currentWebPositionsDerived = useDerivedValue(() => {
    return currentWebPositions.value;
  });

  const top = useSharedValue(index * ROW_HEIGHT);

  const isDraggingDerived = useDerivedValue(() => {
    return isDragging.value;
  });

  const draggedItemIdDerived = useDerivedValue(() => {
    return draggedItemId.value;
  });

  const isCurrentDraggingItem = useDerivedValue(() => {
    return isDraggingDerived.value && draggedItemIdDerived.value === webbing.id;
  });

  const getKeyOfValue = (
    value: number,
    obj: TWebPositions,
  ): string | undefined => {
    'worklet';
    for (const [key, val] of Object.entries(obj)) {
      if (val.updatedIndex === value) {
        return key;
      }
    }
    return undefined; // Return undefined if the value is not found
  };

  // Sync currentIndex when parent re-renders
  useEffect(() => {
    currentIndex.value = index;
  }, [index]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      // start dragging
      isDragging.value = withSpring(1);
      // keep track of dragged item
      draggedItemId.value = webbing.id;
      // store dragged item id for future swap
      currentIndex.value =
        currentWebPositionsDerived.value[webbing.id].updatedIndex;
    })
    .onUpdate((e) => {
      if (draggedItemIdDerived.value === null) {
        return;
      }

      const newTop =
        currentWebPositionsDerived.value[draggedItemIdDerived.value]
          .updatedTop + e.translationY;

      if (currentIndex.value === null) return;

      top.value = newTop;
      // calculate the new index where drag is headed to
      let newIndexVal = Math.floor((newTop + ROW_HEIGHT / 2) / ROW_HEIGHT);
      newIndexVal = Math.max(0, Math.min(newIndexVal, totalItems - 1));
      newIndex.value = newIndexVal;
      // swap the items present at newIndex and currentIndex
      if (newIndex.value !== currentIndex.value) {
        // find id of the item that currently resides at newIndex
        const newIndexItemKey = getKeyOfValue(
          newIndex.value,
          currentWebPositionsDerived.value,
        );
        // find id of the item that currently resides at currentIndex
        const currentDragIndexItemKey = getKeyOfValue(
          currentIndex.value,
          currentWebPositionsDerived.value,
        );

        if (
          newIndexItemKey !== undefined &&
          currentDragIndexItemKey !== undefined
        ) {
          // update updatedTop and updatedIndex so that next time calculations start from the new values
          currentWebPositions.value = {
            ...currentWebPositionsDerived.value,
            [newIndexItemKey]: {
              ...currentWebPositionsDerived.value[newIndexItemKey],
              updatedIndex: currentIndex.value,
              updatedTop: currentIndex.value * ROW_HEIGHT,
            },
            [currentDragIndexItemKey]: {
              ...currentWebPositionsDerived.value[currentDragIndexItemKey],
              updatedIndex: newIndex.value,
            },
          };
          // update new index as current index
          currentIndex.value = newIndex.value;
        }
      }
    })
    .onEnd(() => {
      if (currentIndex.value === null || newIndex.value === null) {
        return;
      }

      top.value = withSpring(newIndex.value * ROW_HEIGHT, {
        stiffness: 400,
        damping: 25,
      });
      // find original id of the item that currently resides at currentIndex
      const currentDragIndexItemKey = getKeyOfValue(
        currentIndex.value,
        currentWebPositionsDerived.value,
      );

      if (currentDragIndexItemKey !== undefined) {
        // update the values for the dragged item
        currentWebPositions.value = {
          ...currentWebPositionsDerived.value,
          [currentDragIndexItemKey]: {
            ...currentWebPositionsDerived.value[currentDragIndexItemKey],
            updatedTop: newIndex.value * ROW_HEIGHT,
          },
        };
      }

      // Call swap with original index and new index if different
      if (newIndex.value !== index) {
        runOnJS(swap)(index, newIndex.value);
      }

      // stop dragging
      isDragging.value = withDelay(200, withSpring(0));
    });

  useAnimatedReaction(
    () => {
      return currentWebPositionsDerived.value[webbing.id].updatedIndex;
    },
    (currentValue, previousValue) => {
      if (currentValue !== previousValue) {
        top.value =
          currentWebPositionsDerived.value[webbing.id].updatedIndex *
          ROW_HEIGHT;
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    top: top.value,
    transform: [
      {
        scale: isCurrentDraggingItem.value
          ? interpolate(isDraggingDerived.value, [0, 1], [1, 1.025])
          : interpolate(isDraggingDerived.value, [0, 1], [1, 0.98]),
      },
    ],
    zIndex: isDragging.value ? 999 : 0,
    backgroundColor: isCurrentDraggingItem.value
      ? interpolateColor(
          isDraggingDerived.value,
          [0, 1],
          ['rgba(255, 255, 255, 0)', 'rgba(241, 245, 249, 1)'],
        )
      : 'rgba(255, 255, 255, 1)',
    // TODO: The code below is raising an error, the code doesn't crash, but it keeps logging the following on the console
    // ERROR  Warning: You are setting the style `{ shadowOffset: ... }` as a prop. You should nest it in a style object. E.g. `{ style: { shadowOffset: ... } }`
    // shadowColor: isCurrentDraggingItem.value
    //   ? interpolateColor(
    //       isDraggingDerived.value,
    //       [0, 1],
    //       ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.35)'],
    //     )
    //   : undefined,
    // shadowOffset: {
    //   width: 0,
    //   height: isCurrentDraggingItem.value
    //     ? interpolate(isDraggingDerived.value, [0, 1], [0, 7])
    //     : 0,
    // },
    // shadowOpacity: isCurrentDraggingItem.value
    //   ? interpolate(isDraggingDerived.value, [0, 1], [0, 0.2])
    //   : 0,
    // shadowRadius: isCurrentDraggingItem.value
    //   ? interpolate(isDraggingDerived.value, [0, 1], [0, 10])
    //   : 0,
    // elevation: isCurrentDraggingItem.value
    //   ? interpolate(isDraggingDerived.value, [0, 1], [0, 5])
    //   : 0, // For Android,
  }));

  return (
    <Animated.View
      style={[
        {
          height: ROW_HEIGHT,
          position: 'absolute',
        },
        animatedStyle,
      ]}
      layout={_layoutAnimation}
      className="rounded flex-row items-center w-full gap-2 pl-2 pr-3"
    >
      <GestureDetector gesture={panGesture}>
        <View>
          <Icon
            as={GripVerticalIcon}
            className="size-6 text-muted-foreground"
          />
        </View>
      </GestureDetector>

      <TouchableOpacity
        onPress={onPressWebbing}
        className="flex-row justify-between items-center flex-1"
      >
        <View className="flex-row gap-1">
          <Text className="text-muted-foreground">{`#${POSITION}`}</Text>
          <Text>{webbing.tagName}</Text>
        </View>
        <View className="flex-row gap-1 items-center">
          {webbing.webbingId ? (
            <WebRowAvatar webbingID={+webbing.webbingId} />
          ) : null}
          <Icon
            as={MoveHorizontalIcon}
            className="size-4 text-primary opacity-70"
          />
          <Text className="text-muted-foreground">{webbing.length}m</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const WebRowAvatar: React.FC<{ webbingID: number }> = ({ webbingID }) => {
  const { data } = useWebbing(webbingID);
  if (!data) return null;
  return (
    <View className="relative overflow-hidden size-8">
      <SupabaseAvatar profileID={data.user_id} />
    </View>
  );
};

const AddSectionButton: React.FC<{
  type: WebType;
  handleNewSection: (type: WebType) => void;
}> = ({ type, handleNewSection }) => {
  const { t } = useTranslation();
  return (
    <AnimatedTouchableOpacity
      layout={_layoutAnimation}
      onPress={() => handleNewSection(type)}
      className="flex-row gap-1 items-center ml-2"
    >
      <Icon as={CirclePlusIcon} className="size-6 text-primary" />
      <Text className="text-base text-primary">
        {type === 'main'
          ? t('components.webbing-setup.sortable-webbing-list.addMainSection')
          : t(
              'components.webbing-setup.sortable-webbing-list.addBackupSection',
            )}
      </Text>
    </AnimatedTouchableOpacity>
  );
};

export type TWebPositions = {
  [key: string]: {
    updatedIndex: number;
    updatedTop: number;
  };
};

export const getInitialPositions = (
  webbings: WebbingWithId[],
): TWebPositions => {
  const webPositions: TWebPositions = {};
  for (let i = 0; i < webbings.length; i++) {
    webPositions[webbings[i].id] = {
      updatedIndex: i,
      updatedTop: i * ROW_HEIGHT,
    };
  }
  return webPositions;
};
