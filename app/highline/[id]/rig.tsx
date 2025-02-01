import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useId, useMemo, useState } from 'react';
import { Controller, type SubmitHandler } from 'react-hook-form';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  LinearTransition,
} from 'react-native-reanimated';

import {
  getWebbingName,
  RigFormProvider,
  RigSchema,
  useRiggingForm,
  type WebbingSchemaWithPreffiled,
  type WebType,
} from '~/context/rig-form';
import { useWebbings, type WebbingWithModel } from '~/hooks/useWebbings';
import HighlineRigIllustration from '~/lib/icons/highline-rig';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';

import SuccessAnimation from '~/components/animations/success-animation';
import { KeyboardAwareScrollView } from '~/components/KeyboardAwareScrollView';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { WebList } from '~/components/sortable-webbing-list';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
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
import { Text } from '~/components/ui/text';
import { H1, H3, Muted } from '~/components/ui/typography';
import { WebbingInput } from '~/components/webbing-input';
import {
  WebbingSetup,
  type WebbingValidationErrors,
} from '~/components/webbing-setup';

const DAMPING = 14;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);

const AnimatedCard = Animated.createAnimatedComponent(Card);

export default function Screen() {
  const { id: highlineId } = useLocalSearchParams<{ id: string }>();

  return (
    <RigFormProvider highlineID={highlineId}>
      <HighlineSetup />
    </RigFormProvider>
  );
}

export const HighlineSetup: React.FC = () => {
  const { form, mutation, highline, setupIsPending } = useRiggingForm();
  const router = useRouter();

  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [<DateForm key="DateForm" />, <Equipments key="Equipments" />],
    [],
  );

  const handleNextStep = async (newStep: number) => {
    // Move back
    if (newStep >= 0 && newStep < step) {
      setStep((prevStep) => prevStep - 1);
      return;
    }

    // Move forward
    if (step < steps.length - 1) {
      setStep((prevStep) => prevStep + 1);
    }
  };

  // Implement handleSave to call the mutation.
  const handleSave: SubmitHandler<RigSchema> = async (data) => {
    await mutation.mutateAsync(data);
  };

  if (mutation.isSuccess) {
    return (
      <View className="h-full items-center justify-center gap-8">
        <View>
          <H1 className="text-center">BOA CHOOSEN</H1>
          <Text className="text-3xl text-center">🆑 🆑 🆑 🆑 🆑</Text>
        </View>
        <View className="h-52 items-center justify-center">
          <SuccessAnimation />
        </View>
        <Text className="text-center w-3/4">
          A montagem está planejada para{' '}
          {form.getValues('rigDate').toLocaleDateString('pt-BR')}, você pode
          voltar e fazer modificações quando precisar.
        </Text>
        <Link
          href={{
            pathname: '/highline/[id]',
            params: { id: highline.id },
          }}
          asChild
        >
          <Button>
            <Text>Ver o Highline</Text>
          </Button>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      /* Parent takes full screen height */
      contentContainerClassName="flex-grow px-6 pt-8 gap-4"
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        /* Step content - sizes naturally */
        className="gap-4 items-center"
        entering={FadeInRight}
        exiting={FadeOutLeft}
      >
        {steps[step]}
      </Animated.View>

      <View
        className="flex-grow"
        /* Spacer to push paginator down */
      />

      <View
        className="gap-4 pb-8"
        /* Paginator/Navigator - stays at bottom when content is short */
      >
        <OnboardPaginator total={steps.length} selectedIndex={step} />
        <OnboardNavigator
          total={steps.length}
          selectedIndex={step}
          onIndexChange={handleNextStep}
          onFinish={form.handleSubmit(handleSave)}
          goBack={router.back}
          isLoading={mutation.isPending || setupIsPending}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const DateForm: React.FC = () => {
  const { form, setupIsPending } = useRiggingForm();
  const colorScheme = useColorScheme();

  return (
    <>
      <HighlineRigIllustration
        mode={colorScheme.colorScheme}
        className="w-full h-auto"
      />

      {setupIsPending ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <View>
            <H3 className="text-center">Primeiro, escolha uma data</H3>
            <Muted className="text-center">
              A data em que a missão irá acontecer
            </Muted>
          </View>

          <Controller
            control={form.control}
            name="rigDate"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                mode="date"
                locale="pt-BR"
                date={value}
                minimumDate={new Date()}
                onDateChange={(date) => onChange(date)}
                timeZoneOffsetInMinutes={0} // https://github.com/henninghall/react-native-date-picker/issues/841
                theme={colorScheme.colorScheme}
              />
            )}
          />
        </>
      )}
    </>
  );
};

const Equipments: React.FC = () => {
  const {
    form,
    main,
    backup,
    focusedWebbing,
    highlineLength,
    setFocusedWebbing,
    handleNewSection,
  } = useRiggingForm();

  const [webbingValidationErrors, setWebbingValidationErrors] =
    useState<WebbingValidationErrors>({});

  return (
    <AnimatedCard layout={_layoutAnimation} className="w-full">
      <CardHeader className="gap-3">
        <CardTitle>Setup da fita</CardTitle>
        <View className="flex-row justify-between">
          <View className="flex-row gap-1 items-center">
            <View className="w-6 h-2 bg-red-500" />
            <Text className="text-muted-foreground">Principal</Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-6 h-2 bg-blue-500" />
            <Text className="text-muted-foreground">Backup</Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-4 h-2 bg-black" />
            <Text className="text-muted-foreground">Loop</Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-4 h-2 bg-green-500" />
            <Text className="text-muted-foreground">Conexão</Text>
          </View>
        </View>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <WebbingSetup
          form={form}
          mainSections={main.fields}
          backupSections={backup.fields}
          focusedWebbing={focusedWebbing}
          highlineLength={highlineLength}
          setFocusedWebbing={setFocusedWebbing}
          onValidationError={setWebbingValidationErrors}
        />
      </CardContent>

      <CardFooter className="border-border border-t pt-4">
        {focusedWebbing ? (
          <WebForm />
        ) : (
          <WebList
            backupSections={backup.fields}
            mainSections={main.fields}
            errorMessages={webbingValidationErrors}
            setFocusedWebbing={setFocusedWebbing}
            swapMain={main.swap}
            swapBackup={backup.swap}
            handleNewSection={handleNewSection}
          />
        )}
      </CardFooter>
    </AnimatedCard>
  );
};

const WebForm: React.FC = () => {
  const { form, main, backup, focusedWebbing, setFocusedWebbing } =
    useRiggingForm();

  if (!focusedWebbing) return;

  const webbing = form.watch(
    `webbing.${focusedWebbing.type}.${focusedWebbing.index}`,
  );

  const handleDeleteSection = useCallback((type: WebType, index: number) => {
    if (type === 'main') {
      main.remove(index);
    } else {
      backup.remove(index);
    }
    setFocusedWebbing(null);
  }, []);

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
    [focusedWebbing],
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
    [focusedWebbing],
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
    [focusedWebbing],
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

const SelectMyWebbing: React.FC<{
  webbing: WebbingSchemaWithPreffiled;
  onSelectWebbing: (webbing: WebbingWithModel[number] | null) => void;
}> = ({ webbing, onSelectWebbing }) => {
  const id = useId();
  const [triggerWidth, setTriggerWidth] = useState<number>(0);
  const { data, isPending } = useWebbings();

  // Access the current rigging form values
  const { main, backup, focusedWebbing } = useRiggingForm();

  // Build a set of ID's of webbings that are in use on the current form
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
        Minhas fitas
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
              placeholder="Ex.: Brasileirinha"
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
                // Append a note to the label if this webbing is already in use.
                const label =
                  getWebbingName(item) + (isUsed ? ' (em uso)' : '');
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
                <Text>limpar</Text>
              </Button>
            </ScrollView>
          </SelectContent>
        </Select>
      )}
    </View>
  );
};
