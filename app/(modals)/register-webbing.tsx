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
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '~/context/auth';
import RegisterWebbingIllustration from '~/lib/icons/register-webbing';
import { supabase } from '~/lib/supabase';

import { KeyboardAwareScrollView } from '~/components/KeyboardAwareScrollView';
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
import {
  WebbingInput,
  webbingSchema,
  type WebbingSchema,
} from '~/components/webbing-input';

export default function RegisterWebbing() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const router = useRouter();
  const form = useForm<WebbingSchema>({
    resolver: zodResolver(webbingSchema),
    mode: 'onChange',
    defaultValues: {
      model: '',
      length: '',
      leftLoop: false,
      rightLoop: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: WebbingSchema) => {
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
      queryClient.invalidateQueries({ queryKey: ['webbing', profile?.id] });
      router.back();
    },
  });

  const onSubmit: SubmitHandler<WebbingSchema> = async (data) => {
    await mutation.mutateAsync(data);
  };

  const onError = (e: FieldErrors<WebbingSchema>) => {
    console.log({ e });
  };

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="flex-1 px-6 py-8 gap-4"
        keyboardShouldPersistTaps="handled"
      >
        <PrefillForm form={form} />

        <View className="gap-4">
          <OnboardNavigator
            total={1}
            selectedIndex={0}
            onIndexChange={() => {}} // There is only one step
            onFinish={form.handleSubmit(onSubmit, onError)}
            goBack={router.back}
            isLoading={mutation.isPending}
            finishText="Cadastrar"
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const PrefillForm: React.FC<{ form: UseFormReturn<WebbingSchema> }> = ({
  form,
}) => {
  const [leftLoop, rightLoop, length] = useWatch({
    control: form.control,
    name: ['leftLoop', 'rightLoop', 'length'],
  });

  return (
    <Animated.View
      className="flex-1 gap-6"
      entering={FadeInRight}
      exiting={FadeOutLeft}
    >
      <RegisterWebbingIllustration className="w-full h-auto" />

      <View>
        <H3 className="text-center">Registrar fita</H3>
        <Muted className="text-center">
          Registrar sua fita permite acompanhar o histórico de uso e receber
          lembretes de manutenção.
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
    </Animated.View>
  );
};

const SelectWebbing: React.FC<{ control: Control<WebbingSchema> }> = ({
  control,
}) => {
  const id = useId();
  const [triggerWidth, setTriggerWidth] = useState<number>(0);

  return (
    <View className="gap-2">
      <Label htmlFor={id} nativeID={id}>
        Modelo da fita
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
              <SelectValue placeholder="Ex.: Brasileirinha" />
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
