import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import i18next from 'i18next';
import React, { useMemo, useState } from 'react';
import { Controller, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, View } from 'react-native';
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
import { supabase } from '~/lib/supabase';
import { useColorScheme } from '~/lib/useColorScheme';
import { TablesInsert } from '~/utils/database.types';
import { requestReview } from '~/utils/request-review';

import SuccessAnimation from '~/components/animations/success-animation';
import { OnboardNavigator, OnboardPaginator } from '~/components/onboard';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { H1, H3, Muted } from '~/components/ui/typography';
import { WebbingSetup } from '~/components/webbing-setup';

const DAMPING = 14;
export const _layoutAnimation = LinearTransition.springify().damping(DAMPING);
export const _exitingAnimation = FadeOut.springify().damping(DAMPING);
export const _enteringAnimation = FadeInDown.springify().damping(DAMPING);

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

  const [step, setStep] = useState(0);
  const steps = useMemo(
    () => [
      <DateForm key="DateForm" isLoading={setupIsPending} />,
      <WebbingSetup key="WebbingSetup" />,
    ],
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
      }
    },
    [latestSetup],
  );

  const mutation = useMutation({
    mutationFn: async (data: RigSchema) => {
      let setupID: number;

      // Check if highline has a planned rig setup
      if (latestSetup && !latestSetup.is_rigged && !latestSetup.unrigged_at) {
        setupID = latestSetup.id;

        // Delete existing webbing rows associated with this rig setup.
        // This way we avoid having to individually update or delete each row.
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
            rig_date: data.rigDate.toISOString(), // converting Date to string
          })
          .eq('id', setupID)
          .select()
          .single();

        if (rigSetupError || !rigSetupData) {
          throw new Error(
            rigSetupError?.message || 'Failed to insert rig setup',
          );
        }
      } else {
        const { data: rigSetupData, error: rigSetupError } = await supabase
          .from('rig_setup')
          .insert({
            highline_id: highlineID,
            is_rigged: false,
            rig_date: data.rigDate.toISOString(), // converting Date to string
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
      // We assume that the types for rig_setup_webbing rows have been imported
      const webbingRows: TablesInsert<'rig_setup_webbing'>[] = [];

      // Process the "main" webbing items
      data.webbing.main.forEach((item) => {
        webbingRows.push({
          left_loop: item.leftLoop,
          length: Number(item.length), // convert the string to a number
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

      return { setupID, webbings: webbingData };
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
          finishLabel={t('app.highline.rig.navigator.finishLabel')}
          goBack={router.back}
          isLoading={mutation.isPending || setupIsPending}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const DateForm: React.FC<{ isLoading?: boolean }> = ({ isLoading }) => {
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
