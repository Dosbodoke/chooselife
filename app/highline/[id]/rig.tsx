import { zodResolver } from '@hookform/resolvers/zod';
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import { PostgrestError } from '@supabase/supabase-js';
import AsyncStorage from 'expo-sqlite/kv-store';
import React, { useMemo, useState } from 'react';
import {
  Controller,
  SubmitHandler,
  useForm,
  UseFormReturn,
} from 'react-hook-form';
import {
  Image,
  Keyboard,
  Pressable,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import {
  Gesture,
  GestureDetector,
  GestureEvent,
  PanGestureHandler,
  PinchGestureHandler,
  PinchGestureHandlerEventPayload,
} from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import HighlineRigIllustration from '~/lib/icons/highline-rig';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';

import { KeyboardAwareScrollView } from '~/components/KeyboardAwareScrollView';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { SupabaseAvatar } from '~/components/ui/avatar';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H2, H3, Muted } from '~/components/ui/typography';

const webbing = z.object({
  length: z.string(),
  left_loop: z.boolean(),
  right_loop: z.boolean(),
});

// Define Zod schema for form validation
const profileSchema = z.object({
  webbing: z
    .object({
      mainWebbing: z.array(webbing),
      backupWebbing: z.array(webbing),
    })
    .refine(({ mainWebbing, backupWebbing }) => {}),
  rig_date: z.date(),
});

// Define TypeScript type based on Zod schema
type ProfileFormData = z.infer<typeof profileSchema>;

export default function SetProfile() {
  const { session, profile } = useAuth();

  const [index, setIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: {
      webbing: {
        backupWebbing: [],
        mainWebbing: [],
      },
      rig_date: new Date(),
    },
  });

  const handleSave: SubmitHandler<ProfileFormData> = async (data) => {
    return;
  };

  const steps = [
    <DateForm key="DateForm" form={form} />,
    <Equipments key="Equipments" form={form} />,
  ];

  const handleNextStep = async (newStep: number) => {
    // Move back
    if (newStep >= 0 && newStep < index) {
      setIndex((prevIndex) => prevIndex - 1);
      return;
    }

    // Move forward
    if (index < steps.length - 1) {
      setIndex((prevIndex) => prevIndex + 1);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="flex-1 px-6 py-8 gap-4"
      keyboardShouldPersistTaps="handled"
    >
      {steps[index]}

      <View className="gap-4">
        <OnboardPaginator total={steps.length} selectedIndex={index} />
        <OnboardNavigator
          total={steps.length}
          selectedIndex={index}
          onIndexChange={handleNextStep}
          onFinish={form.handleSubmit(handleSave)}
          isLoading={isLoading}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

const DateForm = ({ form }: { form: UseFormReturn<ProfileFormData> }) => {
  const colorScheme = useColorScheme();

  return (
    <Animated.View
      className="gap-4 items-center flex-1"
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <HighlineRigIllustration
        mode={colorScheme.colorScheme}
        className="w-full h-auto"
      />

      <View>
        <H3 className="text-center">Primeiro, escolha uma data</H3>
        <Muted className="text-center">
          A data em que a missão irá acontecer
        </Muted>
      </View>

      <Controller
        control={form.control}
        name="rig_date"
        render={({ field: { value } }) => (
          <DatePicker
            mode="date"
            locale="pt-BR"
            date={value}
            minimumDate={new Date()}
            onConfirm={(date) => {
              form.setValue('rig_date', date);
            }}
            timeZoneOffsetInMinutes={0} // https://github.com/henninghall/react-native-date-picker/issues/841
            theme={colorScheme.colorScheme}
          />
        )}
      />
    </Animated.View>
  );
};

const Equipments = ({ form }: { form: UseFormReturn<ProfileFormData> }) => {
  // CANVAS PADDING CONSTANS
  const CANVA_PADDING = 50;

  const handleNewSection = () => {};

  // Gesture handling values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      console.log({ savedTranslateY, ty: event.translationY });
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;

      // Limit zoom range
      scale.value = Math.max(0.5, Math.min(newScale, 3));
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withTiming(1, { duration: 200 });
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    doubleTapGesture,
  );

  // Example webbing sections
  const webbingSections = {
    main: [
      { length: 50 },
      { length: 50 },
      { length: 100 },
      { length: 50 },
      { length: 50 },
    ],
    backup: [{ length: 100 }, { length: 100 }, { length: 50 }, { length: 50 }],
  };

  const generateWebbingPaths = (
    sections: Array<{ length: number }>,
    type: 'main' | 'backup',
    padding: number,
  ) => {
    const paths: string[] = [];
    sections.reduce(
      (acc, curr, idx, arr) => {
        // const startY = type === 'main' ? 100 : 150;
        console.log({ acc, curr, idx, arr });
        const startY = 100;
        const startX = acc.length;
        const endX = startX + arr[idx].length;
        const middleX = startX + arr[idx].length / 2;

        if (type === 'main') {
          paths.push(`M${startX},${startY} L${endX},${startY}`);
        } else {
          paths.push(
            `M${startX},${startY} C${startX},${startY} ${middleX},${startY + 50} ${endX},${startY}`,
          );
        }

        return { length: endX };
      },
      { length: padding },
    );
    return paths;
  };

  const mainWebbingPaths = generateWebbingPaths(
    webbingSections.main,
    'main',
    CANVA_PADDING,
  );
  const backupWebbingPaths = generateWebbingPaths(
    webbingSections.backup,
    'backup',
    CANVA_PADDING,
  );

  return (
    <Animated.View
      className="gap-4 flex-1"
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <Card>
        <CardHeader>
          <CardTitle>Fita</CardTitle>
        </CardHeader>
        <CardContent className="text-center p-0 relative">
          <View className="absolute inset-0 bg-gray-100">
            {/* Custom dot pattern */}
            {/* <View className="absolute inset-0 bg-dotted-pattern opacity-20" /> */}
          </View>
          <View className="relative w-full h-64 overflow-hidden">
            <GestureDetector gesture={composedGesture}>
              <Animated.View
                style={[
                  {
                    flex: 1,
                  },
                  animatedStyle,
                ]}
              >
                <Canvas
                  style={{
                    flex: 1,
                    minWidth: 300 + CANVA_PADDING * 2,
                    backgroundColor: '#f87171',
                  }}
                >
                  {/* Render main webbing paths */}
                  {mainWebbingPaths.map((path, index) => (
                    <Path
                      key={`main-${index}`}
                      path={path}
                      color="blue"
                      style="stroke"
                      strokeWidth={3}
                    />
                  ))}

                  {/* Render backup webbing paths */}
                  {backupWebbingPaths.map((path, index) => (
                    <Path
                      key={`backup-${index}`}
                      path={path}
                      color="red"
                      style="stroke"
                      strokeWidth={3}
                    />
                  ))}
                </Canvas>
              </Animated.View>
            </GestureDetector>
          </View>
        </CardContent>
        <CardFooter className="flex-row justify-between border-border border-t p-4">
          <TouchableOpacity onPress={handleNewSection}>
            <Text className="text-blue-500 text-base">Adicionar seção</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNewSection}>
            <Text className="text-blue-500 text-base">Adicionar backup</Text>
          </TouchableOpacity>
        </CardFooter>
      </Card>
    </Animated.View>
  );
};
