import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import i18next from 'i18next';
import React, { useCallback, useId, useMemo, useState } from 'react';
import { Controller, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
import { useProfile } from '~/hooks/use-profile';
import {
  useWebbing,
  useWebbings,
  type WebbingWithModel,
} from '~/hooks/use-webbings';
import HighlineRigIllustration from '~/lib/icons/highline-rig';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';

import SuccessAnimation from '~/components/animations/success-animation';
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
import { Skeleton } from '~/components/ui/skeleton';
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
  const { t } = useTranslation();
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
          <H1 className="text-center">{t('app.highline.rig.success.title')}</H1>
          <Text className="text-3xl text-center">
            {t('app.highline.rig.success.subtitle')}
          </Text>
        </View>
        <View className="h-52 items-center justify-center">
          <SuccessAnimation />
        </View>
        <Text className="text-center w-3/4">
          {t('app.highline.rig.success.message', {
            date: form.getValues('rigDate').toLocaleDateString('pt-BR'),
          })}
        </Text>
        <Link
          href={{
            pathname: '/highline/[id]',
            params: { id: highline.id },
          }}
          replace
          asChild
        >
          <Button>
            <Text>{t('app.highline.rig.success.button')}</Text>
          </Button>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="flex-grow px-6 pt-8 gap-4"
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        className="gap-4 items-center"
        entering={FadeInRight}
        exiting={FadeOutLeft}
      >
        {steps[step]}
      </Animated.View>

      <View className="flex-grow" />
      <View className="gap-4 pb-8">
        <OnboardPaginator total={steps.length} selectedIndex={step} />
        <OnboardNavigator
          total={steps.length}
          selectedIndex={step}
          onIndexChange={handleNextStep}
          onFinish={form.handleSubmit(handleSave)}
          finishLabel={t('app.highline.rig.navigator.finishLabel')}
          goBack={router.back}
          isLoading={mutation.isPending || setupIsPending}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const DateForm: React.FC = () => {
  const { t } = useTranslation();
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
            <H3 className="text-center">
              {t('app.highline.rig.dateForm.title')}
            </H3>
            <Muted className="text-center">
              {t('app.highline.rig.dateForm.description')}
            </Muted>
          </View>

          <Controller
            control={form.control}
            name="rigDate"
            render={({ field: { value, onChange } }) => (
              <DatePicker
                mode="date"
                locale={i18next.language}
                date={value}
                minimumDate={new Date()}
                onDateChange={(date) => onChange(date)}
                timeZoneOffsetInMinutes={0}
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
  const { t } = useTranslation();
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
        <CardTitle>{t('app.highline.rig.equipments.title')}</CardTitle>
        <View className="flex-row justify-between">
          <View className="flex-row gap-1 items-center">
            <View className="w-6 h-2 bg-red-500" />
            <Text className="text-muted-foreground">
              {t('app.highline.rig.equipments.main')}
            </Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-6 h-2 bg-blue-500" />
            <Text className="text-muted-foreground">
              {t('app.highline.rig.equipments.backup')}
            </Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-4 h-2 bg-black" />
            <Text className="text-muted-foreground">
              {t('app.highline.rig.equipments.loop')}
            </Text>
          </View>

          <View className="flex-row gap-1 items-center">
            <View className="w-4 h-2 bg-green-500" />
            <Text className="text-muted-foreground">
              {t('app.highline.rig.equipments.connection')}
            </Text>
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
        {t('app.highline.rig.webbingOwner.label')}
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
  const [triggerWidth, setTriggerWidth] = useState<number>(0);
  const { data, isPending } = useWebbings();

  // Access the current rigging form values
  const { main, backup, focusedWebbing } = useRiggingForm();

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
        {t('app.highline.rig.selectMyWebbing.label')}
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
              placeholder={t('app.highline.rig.selectMyWebbing.placeholder')}
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
                const inUseLabel = t('app.highline.rig.selectMyWebbing.inUse');
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
                <Text>{t('app.highline.rig.selectMyWebbing.clear')}</Text>
              </Button>
            </ScrollView>
          </SelectContent>
        </Select>
      )}
    </View>
  );
};
