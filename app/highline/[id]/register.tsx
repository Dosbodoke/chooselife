import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Controller, FieldErrors, useForm } from 'react-hook-form';
import { Keyboard, View } from 'react-native';
import { z } from 'zod';

import { useAuth } from '~/context/auth';
import { supabase } from '~/lib/supabase';
import { transformTimeStringToSeconds } from '~/utils';

import SuccessAnimation from '~/components/animations/success-animation';
import { KeyboardAwareScrollView } from '~/components/KeyboardAwareScrollView';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import NumberPicker from '~/components/ui/number-picker';
import { Text } from '~/components/ui/text';
import { Textarea } from '~/components/ui/textarea';
import { H1, Muted, Small } from '~/components/ui/typography';

const formSchema = z.object({
  instagram: z
    .string()
    .trim()
    .startsWith('@', 'O usuário deve começar com @')
    .min(3, 'Deve conter ao menos 3 caracteres'),
  cadenas: z.number().nonnegative(),
  full_lines: z.number().nonnegative(),
  distance: z.coerce
    .number({
      required_error: 'Insira quantos metros você andou',
      invalid_type_error: 'Insira um número',
    })
    .positive('Distância não pode ser negativa'),
  time: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === '' ||
        /^([0-9]|[0-5][0-9]):[0-5][0-9]$/.test(value),
      'Inválido, use o formato mm:ss',
    ),
  witness: z
    .string()
    .refine(
      (w) => /^(?=.*@[^,\s]+,.*@[^,\s]+).*$/.test(w),
      'Inválido, coloque o instagram de duas pessoas, separado por vírgula.',
    ),
  comment: z.string(),
});

type FormSchema = z.infer<typeof formSchema>;

const RegisterHighline = () => {
  const router = useRouter();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  if (!profile) {
    router.push('/(modals)/login');
  }

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      instagram: profile?.username || '',
      cadenas: 0,
      full_lines: 0,
      distance: 0,
      time: '',
      witness: '',
      comment: '',
    },
  });

  // Similar useMutation setup
  const formMutation = useMutation({
    mutationFn: async (formData: FormSchema) => {
      if (!id) throw new Error('No highline ID provided');
      const response = await supabase.from('entry').insert({
        highline_id: id,
        instagram: formData.instagram.toLowerCase(),
        cadenas: formData.cadenas,
        full_lines: formData.full_lines,
        distance_walked: formData.distance,
        crossing_time: formData.time
          ? transformTimeStringToSeconds(formData.time)
          : null,
        comment: formData.comment,
        witness: formData.witness?.replace(' ', '').split(','),
        is_highliner: true, // TODO: Remove this field from database
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry'] });
    },
  });

  function onValid(data: FormSchema) {
    formMutation.mutate(data);
  }

  function onInvalid(errors: FieldErrors<FormSchema>) {
    console.log({ errors });
  }

  return (
    <KeyboardAwareScrollView
      contentContainerClassName="gap-4 p-4 pb-8"
      keyboardShouldPersistTaps="handled"
    >
      {formMutation.isSuccess ? (
        <View className="items-center gap-8">
          <View>
            <H1 className="text-center">BOA CHOOSEN</H1>
            <Text className="text-3xl text-center">🆑 🆑 🆑 🆑 🆑</Text>
          </View>
          <View className="h-52 items-center justify-center">
            <SuccessAnimation />
          </View>
          <Text className="text-center w-3/4">
            Seu rolê está registrado e será usado para calcular as suas
            estatísticas.
          </Text>
          <Link
            href={{
              pathname: '/highline/[id]',
              params: { id: id },
            }}
            asChild
          >
            <Button>
              <Text>Ver o Highline</Text>
            </Button>
          </Link>
        </View>
      ) : (
        <>
          <Controller
            control={form.control}
            name="cadenas"
            render={({ field }) => (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Label nativeID="entry-cadenas">Cadenas</Label>
                  <Muted>
                    Dropou no começo da fita e foi até o final sem cair
                  </Muted>
                </View>
                <NumberPicker value={field.value} onChange={field.onChange} />
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="full_lines"
            render={({ field }) => (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Label nativeID="entry-full_lines">Full lines</Label>
                  <Muted>
                    Você cadenou a ida e a volta, sem descer na virada
                  </Muted>
                </View>
                <NumberPicker value={field.value} onChange={field.onChange} />
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="distance"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="entry-distance">Distância caminhada</Label>

                  <Muted>Quantos metros você andou</Muted>
                </View>
                <Input
                  aria-labelledby="entry-distance"
                  keyboardType="number-pad"
                  className={fieldState.error && 'border-destructive'}
                  {...field}
                  onChangeText={(text) => field.onChange(+text || 0)}
                  value={field.value?.toString()}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="time"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="entry-time">
                    Speedline <Muted>*opcional</Muted>
                  </Label>
                  <Muted>Seu melhor tempo para o ranking do Speedline</Muted>
                </View>

                <Input
                  placeholder="Exemplo.: 4:20"
                  aria-labelledby="entry-time"
                  keyboardType="numbers-and-punctuation"
                  className={fieldState.error && 'border-destructive'}
                  {...field}
                  onChangeText={field.onChange}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="witness"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <View>
                  <Label nativeID="entry-witness">Testemunhas</Label>
                  <Muted>
                    Insira o nome de usuário ou instagram de duas pessoas,
                    separado por vírgula.
                  </Muted>
                </View>
                <Input
                  placeholder="@festivalchooselife, @juangsandrade"
                  aria-labelledby="entry-witness"
                  className={fieldState.error && 'border-destructive'}
                  {...field}
                  onChangeText={field.onChange}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={form.control}
            name="comment"
            render={({ field, fieldState }) => (
              <View className="gap-2">
                <Label nativeID="entry-comment">
                  Comentário <Muted>*opcional</Muted>
                </Label>
                <Textarea
                  keyboardType="default"
                  returnKeyType="done"
                  placeholder="Boa choosen 🤘🆑 Conta pra gente como foi ese rolê, o que achou da fita, da conexão..."
                  aria-labelledby="entry-comment"
                  className={fieldState.error && 'border-destructive'}
                  {...field}
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                  }}
                  onChangeText={(text) => field.onChange(text)}
                />
                {fieldState.error ? (
                  <Small className="text-destructive">
                    {fieldState.error.message}
                  </Small>
                ) : null}
              </View>
            )}
          />

          <Button
            onPress={form.handleSubmit(onValid, onInvalid)}
            disabled={formMutation.isPending}
          >
            <Text>
              {formMutation.isPending ? 'Registrando...' : 'Registrar rolê'}
            </Text>
          </Button>
        </>
      )}
    </KeyboardAwareScrollView>
  );
};

export default RegisterHighline;
