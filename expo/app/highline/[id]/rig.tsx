import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import i18next from 'i18next';
import { icons } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Controller, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import {
  RigFormProvider,
  RigSchema,
  useRiggingForm,
  type WebbingSchemaWithPreffiled,
} from '~/context/rig-form';
import { useHighline } from '~/hooks/use-highline';
import { rigSetupKeyFactory, useRigSetup } from '~/hooks/use-rig-setup';
import { getWebbingName } from '~/hooks/use-webbings';
import { HighlineRigIllustration } from '~/lib/icons/highline-rig';
import { LucideIcon } from '~/lib/icons/lucide-icon';
import { supabase } from '~/lib/supabase';
import { useColorScheme } from '~/lib/useColorScheme';
import { cn } from '~/lib/utils';
import { TablesInsert } from '~/utils/database.types';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { Text } from '~/components/ui/text';
import { H1, H3, Muted } from '~/components/ui/typography';
import { WebbingSetup } from '~/components/webbing-setup';

const DAMPING = 14;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);

// Extended form schema to include rig type
type RigType = 'plan' | 'immediate';

export default function Screen() {
  const { id: highlineID } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id: highlineID });
  if (!highline) return null;

  return (
    <RigFormProvider highlineLength={highline.length}>
      <HighlineSetup />
    </RigFormProvider>
  );
}

export const HighlineSetup: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { id: highlineID } = useLocalSearchParams<{ id: string }>();
  const { highline } = useHighline({ id: highlineID });
  if (!highline) return null;

  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { form } = useRiggingForm();
  const {
    latestSetup,
    query: { isPending: setupIsPending },
  } = useRigSetup({
    highlineID,
  });

  const [step, setStep] = useState(() => {
    const isAlreadyPlanned =
      latestSetup &&
      latestSetup.is_rigged === false &&
      !latestSetup.unrigged_at;

    if (isAlreadyPlanned) return 2;

    return 0;
  });
  const [rigType, setRigType] = useState<RigType>('plan');

  const steps = useMemo(() => {
    const stepComponents = [
      <RigTypeSelection
        key="RigTypeSelection"
        rigType={rigType}
        onRigTypeChange={setRigType}
        isLoading={setupIsPending}
      />,
    ];

    // Only add DateForm step if planning (not immediate rigging)
    if (rigType === 'plan') {
      stepComponents.push(
        <DateForm
          key="DateForm"
          rigType={rigType}
          isLoading={setupIsPending}
        />,
      );
    }

    stepComponents.push(
      <WebbingSetupWithOptionalIndicator key="WebbingSetup" />,
    );

    return stepComponents;
  }, [rigType, setupIsPending]);

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

  // ---------------------------
  // Hydrate the form with the saved data
  // ---------------------------
  React.useEffect(
    function hydrateForm() {
      // Rig is planned
      if (
        latestSetup &&
        latestSetup.is_rigged === false &&
        !latestSetup.unrigged_at
      ) {
        const main: WebbingSchemaWithPreffiled[] = latestSetup.rig_setup_webbing
          .filter((row) => row.webbing_type === 'main')
          .map((row) => ({
            length: row.length.toString(),
            leftLoop: row.left_loop,
            rightLoop: row.right_loop,
            webbingId: row.webbing_id ? row.webbing_id.toString() : undefined,
            tagName: getWebbingName(row.webbing_id),
          }));

        const backup: WebbingSchemaWithPreffiled[] =
          latestSetup.rig_setup_webbing
            .filter((row) => row.webbing_type === 'backup')
            .map((row) => ({
              length: row.length.toString(),
              leftLoop: row.left_loop,
              rightLoop: row.right_loop,
              webbingId: row.webbing_id ? row.webbing_id.toString() : undefined,
              tagName: getWebbingName(row.webbing_id),
            }));

        // Reset the form with the saved values.
        form.reset({
          rigDate: new Date(latestSetup.rig_date),
          webbing: { main, backup },
        });

        // Set rig type based on existing setup
        const isToday =
          new Date(latestSetup.rig_date).toDateString() ===
          new Date().toDateString();
        setRigType(isToday ? 'immediate' : 'plan');
      }
    },
    [latestSetup],
  );

  const mutation = useMutation({
    mutationFn: async (data: RigSchema & { rigType: RigType }) => {
      let setupID: number;
      const isRiggingNow = data.rigType === 'immediate';

      // Check if highline has a planned rig setup
      if (latestSetup && !latestSetup.is_rigged && !latestSetup.unrigged_at) {
        setupID = latestSetup.id;

        // Delete existing webbing rows associated with this rig setup.
        const { error: deleteError } = await supabase
          .from('rig_setup_webbing')
          .delete()
          .eq('setup_id', setupID);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        const { data: rigSetupData, error: rigSetupError } = await supabase
          .from('rig_setup')
          .update({
            rig_date: data.rigDate.toISOString(),
            is_rigged: isRiggingNow,
          })
          .eq('id', setupID)
          .select()
          .single();

        if (rigSetupError || !rigSetupData) {
          throw new Error(
            rigSetupError?.message || 'Failed to update rig setup',
          );
        }
      } else {
        const { data: rigSetupData, error: rigSetupError } = await supabase
          .from('rig_setup')
          .insert({
            highline_id: highlineID,
            is_rigged: isRiggingNow,
            rig_date: data.rigDate.toISOString(),
            riggers: profile?.id ? [profile.id] : [],
            unrigged_at: null,
          })
          .select()
          .single();

        if (rigSetupError || !rigSetupData) {
          throw new Error(
            rigSetupError?.message || 'Failed to insert rig setup',
          );
        }

        setupID = rigSetupData.id;
      }

      // Prepare webbing rows for insertion into `rig_setup_webbing`
      const webbingRows: TablesInsert<'rig_setup_webbing'>[] = [];

      // Process the "main" webbing items
      data.webbing.main.forEach((item) => {
        webbingRows.push({
          left_loop: item.leftLoop,
          length: Number(item.length),
          right_loop: item.rightLoop,
          setup_id: setupID,
          webbing_id: item.webbingId ? Number(item.webbingId) : null,
          webbing_type: 'main',
        });
      });

      // Process the "backup" webbing items
      data.webbing.backup.forEach((item) => {
        webbingRows.push({
          left_loop: item.leftLoop,
          length: Number(item.length),
          right_loop: item.rightLoop,
          setup_id: setupID,
          webbing_id: item.webbingId ? Number(item.webbingId) : null,
          webbing_type: 'backup',
        });
      });

      // Insert the new webbing rows for the current setup
      const { data: webbingData, error: webbingError } = await supabase
        .from('rig_setup_webbing')
        .insert(webbingRows)
        .select();

      if (webbingError) {
        throw new Error(webbingError.message);
      }

      return { setupID, webbings: webbingData, isRigged: isRiggingNow };
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: rigSetupKeyFactory.all({ highlineID }),
      });
      await requestReview();
    },
    onError: (error) => {
      console.error('Error saving rig setup:', error);
    },
  });

  // Implement handleSave to call the mutation.
  const handleSave: SubmitHandler<RigSchema> = async (data) => {
    await mutation.mutateAsync({ ...data, rigType });
  };

  if (mutation.isSuccess) {
    const isRigged = mutation.data?.isRigged;
    return (
      <View className="h-full items-center justify-center gap-8">
        <View>
          <H1 className="text-center">
            {isRigged
              ? t('app.highline.rig.success.rigged.title')
              : t('app.highline.rig.success.planned.title')}
          </H1>
          <Text className="text-3xl text-center">
            {isRigged
              ? t('app.highline.rig.success.rigged.subtitle')
              : t('app.highline.rig.success.planned.subtitle')}
          </Text>
        </View>
        <View className="h-52 items-center justify-center">
          <SuccessAnimation />
        </View>
        <Text className="text-center w-3/4">
          {isRigged
            ? t('app.highline.rig.success.rigged.message')
            : t('app.highline.rig.success.planned.message', {
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
      contentContainerClassName="flex-grow px-6 gap-4"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: Platform.OS === 'ios' ? 24 + insets.bottom : 0,
      }}
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
          finishLabel={
            rigType === 'immediate'
              ? t('app.highline.rig.navigator.rigNow')
              : t('app.highline.rig.navigator.planRig')
          }
          goBack={router.back}
          isLoading={mutation.isPending || setupIsPending}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

// New component for rig type selection
const RigTypeSelection: React.FC<{
  rigType: RigType;
  onRigTypeChange: (type: RigType) => void;
  isLoading?: boolean;
}> = ({ rigType, onRigTypeChange, isLoading }) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();

  if (isLoading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <>
      <HighlineRigIllustration
        mode={colorScheme.colorScheme}
        className="w-full h-auto"
      />

      <View>
        <H3 className="text-center mb-2">
          {t('app.highline.rig.typeSelection.title')}
        </H3>
        <Muted className="text-center">
          {t('app.highline.rig.typeSelection.description')}
        </Muted>
      </View>

      <View className="w-full gap-3">
        <RigTypeOption
          type="immediate"
          isSelected={rigType === 'immediate'}
          onSelect={() => onRigTypeChange('immediate')}
          icon="Zap"
          title={t('app.highline.rig.typeSelection.immediate.title')}
          description={t(
            'app.highline.rig.typeSelection.immediate.description',
          )}
        />

        <RigTypeOption
          type="plan"
          isSelected={rigType === 'plan'}
          onSelect={() => onRigTypeChange('plan')}
          icon="Calendar"
          title={t('app.highline.rig.typeSelection.plan.title')}
          description={t('app.highline.rig.typeSelection.plan.description')}
        />
      </View>
    </>
  );
};

const RigTypeOption: React.FC<{
  type: RigType;
  isSelected: boolean;
  onSelect: () => void;
  icon: keyof typeof icons;
  title: string;
  description: string;
}> = ({ isSelected, onSelect, icon, title, description }) => (
  <TouchableOpacity onPress={onSelect} activeOpacity={0.7}>
    <Card
      className={cn(
        'border-2 transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card',
      )}
    >
      <CardContent className="p-4">
        <View className="flex-row items-center gap-3">
          <View
            className={cn(
              'p-2 rounded-full',
              isSelected ? 'bg-primary/20' : 'bg-muted',
            )}
          >
            <LucideIcon
              name={icon}
              className={cn(
                'size-5',
                isSelected ? 'text-primary' : 'text-muted-foreground',
              )}
            />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-base mb-1">{title}</Text>
            <Text className="text-muted-foreground text-sm">{description}</Text>
          </View>
        </View>
      </CardContent>
    </Card>
  </TouchableOpacity>
);

const DateForm: React.FC<{
  rigType: RigType;
  isLoading?: boolean;
}> = ({ rigType, isLoading }) => {
  const { t } = useTranslation();
  const { form } = useRiggingForm();
  const colorScheme = useColorScheme();

  return (
    <>
      <HighlineRigIllustration
        mode={colorScheme.colorScheme}
        className="w-full h-auto"
      />

      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <View>
            <H3 className="text-center">
              {rigType === 'immediate'
                ? t('app.highline.rig.dateForm.immediate.title')
                : t('app.highline.rig.dateForm.plan.title')}
            </H3>
            <Muted className="text-center">
              {rigType === 'immediate'
                ? t('app.highline.rig.dateForm.immediate.description')
                : t('app.highline.rig.dateForm.plan.description')}
            </Muted>
          </View>

          {rigType === 'plan' && (
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
          )}

          {rigType === 'immediate' && (
            <View className="items-center gap-4">
              <View className="flex-row items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <LucideIcon name="Clock" className="text-green-600 size-5" />
                <Text className="text-green-700 dark:text-green-300 font-medium">
                  {t('app.highline.rig.dateForm.immediate.currentTime', {
                    time: new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    date: new Date().toLocaleDateString('pt-BR'),
                  })}
                </Text>
              </View>
            </View>
          )}
        </>
      )}
    </>
  );
};

const WebbingSetupWithOptionalIndicator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <View className="gap-4 w-full">
      <View className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <View className="flex-row items-center gap-2 mb-2">
          <LucideIcon name="Info" className="text-blue-600 size-5" />
          <Text className="text-blue-700 dark:text-blue-300 font-semibold">
            {t('app.highline.rig.optional.title')}
          </Text>
        </View>
        <Text className="text-blue-600 dark:text-blue-400 text-sm">
          {t('app.highline.rig.optional.description')}
        </Text>
      </View>
      <WebbingSetup />
    </View>
  );
};
