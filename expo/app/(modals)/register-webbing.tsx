import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useId, useState } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  SubmitHandler,
  useForm,
  UseFormReturn,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { useWebbingsKeyFactory } from '~/hooks/use-webbings';
import RegisterWebbingIllustration from '~/lib/icons/register-webbing';
import { supabase } from '~/lib/supabase';
import { requestReview } from '~/utils/request-review';

import { OnboardNavigator } from '~/components/onboard';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { H3, Muted } from '~/components/ui/typography';
import { WebbingInput, webbingSchema } from '~/components/webbing-input';

// Extend your existing webbing schema with a "model" field.
const webbingSchemaWithModel = webbingSchema.extend({
  model: z.string().optional(),
});
type WebbingSchemaWithModel = z.infer<typeof webbingSchemaWithModel>;

export default function RegisterWebbing() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const router = useRouter();
  const form = useForm<WebbingSchemaWithModel>({
    resolver: zodResolver(webbingSchemaWithModel),
    mode: 'onChange',
    defaultValues: {
      model: '',
      length: '',
      leftLoop: false,
      rightLoop: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: WebbingSchemaWithModel) => {
      if (!profile) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('webbing')
        .insert({
          user_id: profile.id,
          left_loop: data.leftLoop,
          right_loop: data.rightLoop,
          length: +data.length,
        })
        .single();

      if (error) throw error;
    },
    onSuccess: () => {
      requestReview();
      queryClient.invalidateQueries({
        queryKey: useWebbingsKeyFactory.webbings(),
      });
      router.back();
    },
  });

  const onSubmit: SubmitHandler<WebbingSchemaWithModel> = async (data) => {
    await mutation.mutateAsync(data);
  };

  const onError = (e: FieldErrors<WebbingSchemaWithModel>) => {
    console.log({ e });
  };

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="px-6 pt-3 pb-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <PrefillForm form={form} />

        <View className="flex-grow">{/* Spacer to push paginator down */}</View>

        <OnboardNavigator
          total={1}
          selectedIndex={0}
          onIndexChange={() => {}} // There is only one step
          onFinish={form.handleSubmit(onSubmit, onError)}
          goBack={router.back}
          isLoading={mutation.isPending}
          finishLabel={t('app.(modals).register-webbing.finishLabel')}
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const PrefillForm: React.FC<{
  form: UseFormReturn<WebbingSchemaWithModel>;
}> = ({ form }) => {
  const { t } = useTranslation();
  const [leftLoop, rightLoop, length] = useWatch({
    control: form.control,
    name: ['leftLoop', 'rightLoop', 'length'],
  });

  return (
    <View className="gap-6">
      <View className="h-52">
        <RegisterWebbingIllustration className="w-full h-full" />
      </View>

      <View>
        <H3 className="text-center">
          {t('app.(modals).register-webbing.title')}
        </H3>
        <Muted className="text-center">
          {t('app.(modals).register-webbing.description')}
        </Muted>
      </View>

      <WebbingInput
        leftLoop={leftLoop}
        rightLoop={rightLoop}
        length={length}
        onLeftLoopChange={(value) => form.setValue('leftLoop', value)}
        onRightLoopChange={(value) => form.setValue('rightLoop', value)}
        onLengthChange={(value) => form.setValue('length', value)}
        error={form.formState.errors.length?.message ?? null}
      />
      <SelectWebbing control={form.control} />
    </View>
  );
};

const SelectWebbing: React.FC<{ control: Control<WebbingSchemaWithModel> }> = ({
  control,
}) => {
  const { t } = useTranslation();
  const id = useId();
  const [triggerWidth, setTriggerWidth] = useState<number>(0);

  return (
    <View className="gap-2">
      <Label htmlFor={id} nativeID={id}>
        {t('app.(modals).register-webbing.modelLabel')}
      </Label>
      <Controller
        control={control}
        name="model"
        render={({ field }) => (
          <Select onValueChange={field.onChange}>
            <SelectTrigger
              id={id}
              aria-labelledby={id}
              onLayout={(e) => {
                const { width } = e.nativeEvent.layout;
                setTriggerWidth(width);
              }}
            >
              <SelectValue
                placeholder={t(
                  'app.(modals).register-webbing.modelPlaceholder',
                )}
              />
            </SelectTrigger>
            <SelectContent style={{ width: triggerWidth }}>
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
              >
                <SelectGroup>
                  <SelectLabel>Bera</SelectLabel>
                  <SelectItem value="sky2" label="Sky 2" />
                  <SelectItem value="sky3d" label="Sky 3d" />
                  <SelectItem value="brasileirinha" label="Brasileirinha" />
                </SelectGroup>
              </ScrollView>
            </SelectContent>
          </Select>
        )}
      />
    </View>
  );
};
